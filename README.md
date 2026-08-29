# Aliquot

A 3D navigable archive of a 13-year tribute-album project.

Full plan, architecture decisions, data model, sprint schedule, and risk register live in
[`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md). This file is the day-to-day map of the repo.

## Layout

```
web/       Vite + React + TypeScript + react-three-fiber — the renderer and UI
etl/       C# console app — MusicBrainz/Discogs/Wikidata/Bandcamp ETL into SQLite, then JSON export
scripts/   Standalone PowerShell tooling (e.g. the Bandcamp catalog harvester)
docs/      Project plan, decisions log, runbook
```

## Working practices (§8 of the plan)

- One sprint = one demo-able thing.
- Deploy on day one and every sprint.
- Cache every API response to disk — `etl/.cache/` (gitignored, regenerable).
- `etl/aliquot.sqlite` is the source of truth and **is committed**. JSON is a build artifact, always regenerable, never hand-edited.
- Architecture calls go in [`docs/DECISIONS.md`](docs/DECISIONS.md), one line of reasoning each.
- Operational procedures (e.g. Bandcamp audio failover) go in [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Local development

**Frontend**
```bash
cd web
npm install
npm run dev
```

**ETL**
```bash
cd etl
dotnet run
```

## Status

Sprint 1 complete. Sprint 2 (Sep 7 – Sep 20, 2026) underway: Bandcamp catalog harvested (146 albums,
3,830 tracks) and normalized into SQLite (cover releases → cover recordings → covering artists).
Synthetic-graph generator for renderer testing done (`scripts/generate-synthetic-graph.mjs`).
Next up: the renderer spike itself (InstancedMesh + LineSegments + OrbitControls, FPS measurement).
See the plan's §5 for the full sprint schedule.
