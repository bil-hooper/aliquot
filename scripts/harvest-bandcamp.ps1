<#
.SYNOPSIS
    Harvests Bandcamp album/track metadata for the Aliquot tribute series, one
    album at a time, with a randomized delay between albums.

.DESCRIPTION
    For each album under the tribute series' Bandcamp subdomain, this script:
      1. Fetches the album page HTML.
      2. Extracts and decodes the embedded `data-tralbum` JSON blob - the same
         data Bandcamp's own embed player reads: album id, release date, and
         each track's id, title, artist, duration, and streaming mp3-128 URL.
      3. Writes the parsed JSON to disk, one file per album, skipping albums
         already harvested so a run can be stopped and resumed freely.

    Album discovery reads /music, not just the landing page - the landing page
    only renders the newest ~16 releases as plain links; the rest of the back
    catalog lives in a separate `data-client-items` JSON blob that Bandcamp's
    own JS uses to lazily fill in the discography grid. Both sources are
    combined and deduplicated, since neither one alone is the full catalog.

    Only /music and /album/ pages are requested - both allowed under
    bandcamp.com's robots.txt for a generic, honestly identified User-Agent
    (robots.txt disallows /api/, /search, /stream, /checkout, /cart/, /tools,
    /download_check, /design_tokens - none of which this script touches).
    See docs/PROJECT_PLAN.md, Sprint 1 (the R1 spike), and docs/RUNBOOK.md.

    A full run across the whole catalog (~146 albums as of writing, and
    growing monthly) takes on the order of half a day by design at the
    default delay (averages ~5.5 minutes between albums, so ~13 hours worst
    case) - run it in a window you're fine leaving open, or across several
    sessions, not as a quick one-off. It's fully resumable either way.

.PARAMETER BandcampSubdomain
    The artist's Bandcamp subdomain, e.g. "prfmonthlytributeseries".

.PARAMETER OutputDirectory
    Where per-album JSON files are written. Defaults to etl/.cache/bandcamp,
    already covered by the repo's .gitignore (etl/.cache/).

.PARAMETER DelayMinSeconds
.PARAMETER DelayMaxSeconds
    Random delay window applied between albums (not between every request).
    Defaults to 60-600 seconds.

.PARAMETER MaxAlbums
    Optional cap on how many *new* albums to fetch this run. 0 = no cap.
    Useful for testing the script itself without committing to a multi-hour run.

.PARAMETER UserAgent
    Sent honestly as-is - no browser impersonation. Bandcamp's own robots.txt
    singles out "ClaudeBot" for a site-wide disallow; this script is meant to
    be run by you, under your own project's identity, not by an AI agent
    fetching on your behalf. See the conversation this script came from.

.EXAMPLE
    # Smoke-test against 2 albums with a short delay before committing to a full run
    ./scripts/harvest-bandcamp.ps1 -MaxAlbums 2 -DelayMinSeconds 5 -DelayMaxSeconds 10

.EXAMPLE
    # Full run, defaults
    ./scripts/harvest-bandcamp.ps1
#>
[CmdletBinding()]
param(
    [string]$BandcampSubdomain = "prfmonthlytributeseries",
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\etl\.cache\bandcamp"),
    [int]$DelayMinSeconds = 60,
    [int]$DelayMaxSeconds = 600,
    [int]$MaxAlbums = 0,
    [string]$UserAgent = "AliquotETL/0.1 (+hotfussbook@gmail.com; archival project, see https://github.com/bil-hooper/aliquot)"
)

$ErrorActionPreference = "Stop"
$baseUrl = "https://$BandcampSubdomain.bandcamp.com"

function Get-HtmlBody {
    param([string]$Url)
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -Headers @{ "User-Agent" = $UserAgent }
    return $response.Content
}

function Get-AlbumPaths {
    param([string]$MusicPageHtml)

    # The /music page only renders the newest releases as plain <a href> links.
    # The rest of the back catalog is a separate JSON blob (`data-client-items`)
    # that Bandcamp's own JS uses to lazily fill in the discography grid -
    # without it, older albums are silently invisible to a plain link scrape.
    # (Found by comparing counts: 16 visible links vs. 146 actual albums.)
    $visible = [regex]::Matches($MusicPageHtml, 'href="(/album/[^"]+)"') |
        ForEach-Object { $_.Groups[1].Value }

    $gridPaths = @()
    $gridMatch = [regex]::Match($MusicPageHtml, 'data-client-items="([^"]*)"')
    if ($gridMatch.Success) {
        $decoded = [System.Net.WebUtility]::HtmlDecode($gridMatch.Groups[1].Value)
        $items = $decoded | ConvertFrom-Json
        $gridPaths = @($items | Where-Object { $_.type -eq "album" } | ForEach-Object { $_.page_url })
    }
    else {
        Write-Warning "[warn] data-client-items not found - only visible links will be used, back catalog may be incomplete"
    }

    return @(($visible + $gridPaths) | Sort-Object -Unique)
}

function Get-TralbumData {
    param([string]$AlbumHtml)
    $match = [regex]::Match($AlbumHtml, 'data-tralbum="([^"]*)"')
    if (-not $match.Success) { return $null }
    $decoded = [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
    return $decoded | ConvertFrom-Json
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$musicUrl = "$baseUrl/music"
Write-Host "Fetching album list from $musicUrl ..."
$musicHtml = Get-HtmlBody -Url $musicUrl
$allAlbumPaths = Get-AlbumPaths -MusicPageHtml $musicHtml
Write-Host "Found $($allAlbumPaths.Count) albums total."

# Only the not-yet-harvested albums count against -MaxAlbums, so re-running
# with the same cap after a partial run still makes forward progress.
# @(...) forces an array even when Where-Object/Select-Object match exactly one
# item - PowerShell otherwise collapses a single result to a bare scalar, which
# silently breaks [$i] indexing further down (it indexes into the string's
# characters instead of the array's elements).
$pendingPaths = @($allAlbumPaths | Where-Object {
    $slug = ($_ -split "/")[-1]
    -not (Test-Path (Join-Path $OutputDirectory "$slug.json"))
})
Write-Host "$($allAlbumPaths.Count - $pendingPaths.Count) already harvested, $($pendingPaths.Count) pending."

if ($MaxAlbums -gt 0) {
    $pendingPaths = @($pendingPaths | Select-Object -First $MaxAlbums)
    Write-Host "Capped to $MaxAlbums for this run."
}

$processed = 0
$failed = 0

for ($i = 0; $i -lt $pendingPaths.Count; $i++) {
    $path = $pendingPaths[$i]
    $slug = ($path -split "/")[-1]
    $outFile = Join-Path $OutputDirectory "$slug.json"
    $albumUrl = "$baseUrl$path"

    try {
        Write-Host "[fetch] $slug ..."
        $html = Get-HtmlBody -Url $albumUrl
        $data = Get-TralbumData -AlbumHtml $html

        if ($null -eq $data) {
            Write-Warning "[warn] $slug - no data-tralbum blob found, skipping"
            $failed++
        }
        else {
            $data | ConvertTo-Json -Depth 20 | Set-Content -Path $outFile -Encoding utf8
            $trackCount = @($data.trackinfo).Count
            Write-Host "[ok]   $slug - album id $($data.id), $trackCount tracks"
            $processed++
        }
    }
    catch {
        Write-Warning "[error] $slug - $($_.Exception.Message)"
        $failed++
    }

    $isLast = ($i -eq $pendingPaths.Count - 1)
    if (-not $isLast) {
        $delay = Get-Random -Minimum $DelayMinSeconds -Maximum ($DelayMaxSeconds + 1)
        Write-Host "  waiting $delay s before the next album ..."
        Start-Sleep -Seconds $delay
    }
}

Write-Host ""
Write-Host "Done. $processed harvested this run, $failed failed. Output: $OutputDirectory"
