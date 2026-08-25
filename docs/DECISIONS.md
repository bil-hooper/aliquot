# Decisions log

Every architecture call, with a date and one line of reasoning (§8). Newest first.

## 2026-08-24 — Repo scaffolded

- **Frontend:** Vite + React + TypeScript + `@react-three/fiber` + `@react-three/drei`, in `web/`. Per §1.3 — R3F gives React ergonomics with imperative escape hatches for the performance-critical 3D. Decision gate on R3F vs. vanilla Three.js is Sprint 2 (§5), not now.
- **ETL:** C# console app in `etl/`, targeting `net10.0`. Per §1.2 — fastest language for the author, zero benefit to JS here.
- **Staging store:** SQLite via `Microsoft.Data.Sqlite`, WAL mode. Per §1.2 and §8 — one file, versionable, committed to the repo as the source of truth.
- **HTTP resilience:** `Polly` for retry/backoff, a fixed-interval `RateLimiter`, and a SHA-256-keyed `DiskResponseCache` so every API response is cached to disk on first fetch (§4, §8).
- **Password hashing (future, §1.7c):** `BCrypt.Net-Next`, added to the ETL project now so the admin-app credentials work in Sprint 4 doesn't need a new dependency.
- **Repo:** public on GitHub, per §1.7's reasoning (keeps Actions unmetered) and the templating goal.
