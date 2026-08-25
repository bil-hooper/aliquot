# Runbook

Operational procedures, written out as checklists before they're ever needed (§8) — not improvised under pressure.

## Bandcamp audio failover (§1.9)

Status: **not yet written.** Depends on the outcome of the Sprint 1 spike (§5, R1) — whether a
downloadable file is obtainable from Bandcamp at all, separate from just getting an embed ID.
Fill this in once that's answered and the `audio_backups[]` registry (§1.9) has real data in it.

Shape it will take once populated:

1. Confirm the trigger — Bandcamp embed failing site-wide, not a single bad ref.
2. Pick the best entry from each affected recording's `audio_backups[]`.
3. Run the promotion script: `audio_backups[best] → audio_source`.
4. Regenerate JSON, sanity-check, redeploy.
5. Spot-check a sample of promoted recordings live.

## Other procedures

Add here as they're identified — e.g. what to do if a scheduled daily sync job fails its
sanity check (§1.7), or how to roll back a bad deploy on Cloudflare Pages.
