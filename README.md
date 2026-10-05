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
**Sprint 2 complete:** renderer spike (`web/src/scene/`) built and the R3F-vs-vanilla-Three.js
decision gate is closed — staying with React Three Fiber, on the strength of a 45fps reading for
the full worst-case 15k-node/31,852-edge scene on a phone GPU (the primary dev machine's own GPU
turned out to be software-rendered — a real driver problem, not a settings issue; see
`docs/DECISIONS.md`, 2026-10-04/05).
Sprint 3's GPU-picking spike (`web/src/scene/PickingLayer.tsx` + `PickingController.tsx`) pulled
forward and confirmed working too — hover and click both correctly resolve nodes via an offscreen
render-target color-ID lookup, no raycasting. Focused-subgraph edge highlighting (dimming
non-neighbor edges) is the next piece, not yet built.
See the plan's §5 for the full sprint schedule.
