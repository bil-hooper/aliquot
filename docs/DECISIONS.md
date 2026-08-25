# Decisions log

Every architecture call, with a date and one line of reasoning (§8). Newest first.

## 2026-08-24 — Repo scaffolded

- **Frontend:** Vite + React + TypeScript + `@react-three/fiber` + `@react-three/drei`, in `web/`. Per §1.3 — R3F gives React ergonomics with imperative escape hatches for the performance-critical 3D. Decision gate on R3F vs. vanilla Three.js is Sprint 2 (§5), not now.
- **ETL:** C# console app in `etl/`, targeting `net10.0`. Per §1.2 — fastest language for the author, zero benefit to JS here.
- **Staging store:** SQLite via `Microsoft.Data.Sqlite`, WAL mode. Per §1.2 and §8 — one file, versionable, committed to the repo as the source of truth.
- **HTTP resilience:** `Polly` for retry/backoff, a fixed-interval `RateLimiter`, and a SHA-256-keyed `DiskResponseCache` so every API response is cached to disk on first fetch (§4, §8).
- **Password hashing (future, §1.7c):** `BCrypt.Net-Next`, added to the ETL project now so the admin-app credentials work in Sprint 4 doesn't need a new dependency.
- **Repo:** public on GitHub, per §1.7's reasoning (keeps Actions unmetered) and the templating goal.
- **Hosting:** Cloudflare Pages, project `aliquot`, live at `aliquot.pages.dev` (§1.4). Deployed manually via `wrangler pages deploy` to prove the path on day one (§8); Git integration connected afterward in the Cloudflare dashboard so pushes to `main` auto-deploy going forward.

## 2026-08-24 — Airtable base structure (§1.7c)

- **Two bases, not one**, per the plan's own recommendation — keeps Credentials' tiny, near-zero record count from ever being a factor in whether the entity-claims base is near its 1,000-record free-tier cap, and vice versa.
- **`Aliquot Credentials`** — one table, `Credentials` (email, password hash, role: `moderator`/`admin`, created/last-login dates). Stays small forever — only ever as many rows as there are moderators.
- **`Aliquot Claims`** — two tables:
  - `Claims` — one row per claimed/claimable Person or Artist: entity id/type/name, contact email, claim token, issued date, status. This is the one that can grow into the hundreds.
  - `Admin Queue` — the single shared queue for both claim requests and "suggest a new member" submissions (§1.6, §1.7), deliberately one table rather than two review systems. No linked-record field between the two tables — a new-member suggestion has no `Claims` row yet to link to, so both just carry a plain-text Entity ID.
- Base IDs and a Personal Access Token to be recorded in the gitignored `appsettings.Local.json` when the admin app is actually built (Sprint 4) — nothing Airtable-related goes in the repo itself.

## 2026-08-25 — R1 spike resolved: Bandcamp embed IDs + backup files

- **Both R1 questions answered yes**, confirmed against the real catalog (16/16 albums, 0 failures): embed track ids and a real downloadable `mp3-128` file are both sitting in a `data-tralbum` JSON attribute on every album page — no headless browser, no scraping framework, just an HTTP GET and a JSON decode.
- **PowerShell, not the C# ETL, for this harvester** (`scripts/harvest-bandcamp.ps1`) — it's a standalone, resumable, long-running (hours, by design) crawl with a deliberately slow random delay between albums (60-600s) to stay well clear of anything that looks like hammering the site. Keeping it separate from the C# ETL app means the ETL's own MusicBrainz/Discogs runs (§4, seconds-to-minutes) aren't coupled to a process that's meant to run for hours in the background. The ETL can ingest `etl/.cache/bandcamp/*.json` as a normal cached input once this has run.
- **Bandcamp's `robots.txt` disallows `ClaudeBot` site-wide.** Noted explicitly in the script's own help text and in `docs/RUNBOOK.md`: this script is meant to be *run by the project owner*, under the project's own identity, not fetched by an AI agent on the owner's behalf. The paths it touches (landing page, `/album/`) are allowed for generic crawlers regardless.
- **Signed download URLs expire ~24h after the page fetch.** This matters for §1.9's backup-tier population later in the plan — harvesting metadata and harvesting the actual audio bytes can't be arbitrarily far apart in time.
