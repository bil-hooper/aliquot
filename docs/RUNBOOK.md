# Runbook

Operational procedures, written out as checklists before they're ever needed (§8) — not improvised under pressure.

## Bandcamp metadata harvesting (§5 Sprint 1, R1)

`scripts/harvest-bandcamp.ps1` fetches every album under the tribute series' Bandcamp subdomain
and decodes the embedded `data-tralbum` JSON blob — album id, release date, and each track's id,
title, artist, duration, and a signed `mp3-128` stream URL. Output lands in `etl/.cache/bandcamp/`
(gitignored), one JSON file per album, and the script skips albums it's already harvested so it's
safe to stop and resume.

**Album discovery reads `/music`, and combines two sources on that page.** The page's visible
`<a href>` links only cover the newest ~16 releases; the rest of the back catalog (130+ more,
back to July 2014) lives in a separate `data-client-items` JSON blob that Bandcamp's own JS uses
to lazily fill in the discography grid as you scroll. A link-only scrape silently missed ~90% of
the catalog until this was caught — **146 albums total**, not the ~16 the first pass found.

**Findings from the spike, confirmed against the real catalog (all 146 albums, 0 failures):**
- Embed track ids are extractable with a plain HTTP GET + regex/JSON-decode — no headless
  browser needed.
- Every track also exposes a real, directly downloadable `audio/mpeg` file at `mp3-128` quality,
  even without Bandcamp's own download feature enabled — usable for §1.9's backup tier, though
  below master quality. **The signed URL expires roughly 24 hours after the page is fetched** —
  any backup harvest has to pull the actual bytes promptly, not just store the URL.
- `bandcamp.com/robots.txt` disallows `/api/`, `/search`, `/stream`, `/checkout`, `/cart/`,
  `/tools`, `/download_check`, `/design_tokens` for generic crawlers — none of which this script
  touches (only `/music` and `/album/` pages). It also carries a site-wide
  `User-agent: ClaudeBot` / `Disallow: /` — this script is meant to be run by you, under the
  project's own identity (the `-UserAgent` default), not invoked by an AI agent on your behalf.
- **Run it yourself, not through an AI session** — a full run across all ~146 albums (growing
  monthly) is on the order of half a day by design (default delay averages ~5.5 min between
  albums, ~13h worst case); that's a deliberate choice to stay well clear of anything that looks
  like hammering the site, not a limitation to route around. It's fully resumable, so splitting
  it across several sittings is fine.

```powershell
# Smoke-test first
./scripts/harvest-bandcamp.ps1 -MaxAlbums 2 -DelayMinSeconds 5 -DelayMaxSeconds 10

# Full run (defaults: 60-600s between albums)
./scripts/harvest-bandcamp.ps1
```

## Bandcamp audio failover (§1.9)

Status: **not yet written.** The harvesting mechanism above proves a backup file is obtainable;
this section is the *promotion* procedure for when `audio_backups[]` (§1.9) has real data in it
and a failover is actually needed.

Shape it will take once populated:

1. Confirm the trigger — Bandcamp embed failing site-wide, not a single bad ref.
2. Pick the best entry from each affected recording's `audio_backups[]`.
3. Run the promotion script: `audio_backups[best] → audio_source`.
4. Regenerate JSON, sanity-check, redeploy.
5. Spot-check a sample of promoted recordings live.

## Other procedures

Add here as they're identified — e.g. what to do if a scheduled daily sync job fails its
sanity check (§1.7), or how to roll back a bad deploy on Cloudflare Pages.
