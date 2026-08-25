-- Aliquot ETL staging schema.
-- 5 node types (Person, Artist, Release, Recording, Work) + 7 edge types (§2.2).
-- FEATURES and SELECTED_BY are deliberately absent — blocked pending a separate
-- forum/site-export ask to the founder (§2.2, §9). Add them when that's unblocked.
-- SHARES_MEMBER and COVERS are derived at build time, never stored here (§2.2).

PRAGMA foreign_keys = ON;

-- ── Nodes ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS person (
    id                  TEXT PRIMARY KEY,
    slug                TEXT UNIQUE,
    legal_name          TEXT,
    display_preference  TEXT NOT NULL DEFAULT 'handle' CHECK (display_preference IN ('name', 'handle', 'both')),
    bio                 TEXT,
    claim_status        TEXT NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed', 'claimed')),
    photo_status        TEXT NOT NULL DEFAULT 'none' CHECK (photo_status IN ('none', 'pending', 'approved')),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Plural, dated handles (§2.1b) — a person can have several over 13 years.
CREATE TABLE IF NOT EXISTS person_handle (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id   TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    handle      TEXT NOT NULL,
    from_date   TEXT,
    to_date     TEXT,
    source      TEXT
);
CREATE INDEX IF NOT EXISTS idx_person_handle_person ON person_handle(person_id);
CREATE INDEX IF NOT EXISTS idx_person_handle_handle ON person_handle(handle);

CREATE TABLE IF NOT EXISTS artist (
    id                  TEXT PRIMARY KEY,
    slug                TEXT UNIQUE,
    name                TEXT NOT NULL,
    role                TEXT NOT NULL CHECK (role IN ('covering', 'original', 'both')),
    bio                 TEXT,
    claim_status        TEXT NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed', 'claimed')),
    photo_status        TEXT NOT NULL DEFAULT 'none' CHECK (photo_status IN ('none', 'pending', 'approved')),
    musicbrainz_id      TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS release (
    id                  TEXT PRIMARY KEY,
    slug                TEXT UNIQUE,
    title               TEXT NOT NULL,
    kind                TEXT NOT NULL CHECK (kind IN ('cover', 'original')),
    release_date        TEXT,
    musicbrainz_id      TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recording (
    id                      TEXT PRIMARY KEY,
    slug                    TEXT UNIQUE,
    title                   TEXT NOT NULL,
    kind                    TEXT NOT NULL CHECK (kind IN ('cover', 'original')),
    audio_source_provider   TEXT,  -- open name: "bandcamp" | "archive_org" | "r2" | "youtube" | ... (§1.9)
    audio_source_ref        TEXT,
    musicbrainz_id          TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- audio_backups[] (§1.9) — ready to promote, not rendered live.
CREATE TABLE IF NOT EXISTS recording_audio_backup (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id    TEXT NOT NULL REFERENCES recording(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    ref             TEXT NOT NULL,
    verified        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_recording_audio_backup_recording ON recording_audio_backup(recording_id);

CREATE TABLE IF NOT EXISTS work (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    musicbrainz_id      TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sticky slug history (§1.8, §2.3 R10) — shared across all entity types so an
-- old handle/name-derived slug keeps resolving after a rename. entity_type
-- names the owning table ("person" | "artist" | "release" | "recording").
CREATE TABLE IF NOT EXISTS slug_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    slug            TEXT NOT NULL,
    UNIQUE (entity_type, slug)
);

-- ── Edges (7) ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS member_of (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id   TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    artist_id   TEXT NOT NULL REFERENCES artist(id) ON DELETE CASCADE,
    role        TEXT,
    from_date   TEXT,
    to_date     TEXT
);
CREATE INDEX IF NOT EXISTS idx_member_of_person ON member_of(person_id);
CREATE INDEX IF NOT EXISTS idx_member_of_artist ON member_of(artist_id);

CREATE TABLE IF NOT EXISTS performed_on (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id       TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    recording_id    TEXT NOT NULL REFERENCES recording(id) ON DELETE CASCADE,
    role            TEXT
);
CREATE INDEX IF NOT EXISTS idx_performed_on_person ON performed_on(person_id);
CREATE INDEX IF NOT EXISTS idx_performed_on_recording ON performed_on(recording_id);

CREATE TABLE IF NOT EXISTS credited_on (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id   TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    release_id  TEXT NOT NULL REFERENCES release(id) ON DELETE CASCADE,
    role        TEXT  -- engineer, artwork, producer, liner notes
);
CREATE INDEX IF NOT EXISTS idx_credited_on_person ON credited_on(person_id);
CREATE INDEX IF NOT EXISTS idx_credited_on_release ON credited_on(release_id);

CREATE TABLE IF NOT EXISTS released (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id   TEXT NOT NULL REFERENCES artist(id) ON DELETE CASCADE,
    release_id  TEXT NOT NULL REFERENCES release(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_released_artist ON released(artist_id);
CREATE INDEX IF NOT EXISTS idx_released_release ON released(release_id);

CREATE TABLE IF NOT EXISTS appears_on (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id    TEXT NOT NULL REFERENCES recording(id) ON DELETE CASCADE,
    release_id      TEXT NOT NULL REFERENCES release(id) ON DELETE CASCADE,
    track_number    INTEGER,
    disc            INTEGER
);
CREATE INDEX IF NOT EXISTS idx_appears_on_recording ON appears_on(recording_id);
CREATE INDEX IF NOT EXISTS idx_appears_on_release ON appears_on(release_id);

CREATE TABLE IF NOT EXISTS performance_of (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id    TEXT NOT NULL REFERENCES recording(id) ON DELETE CASCADE,
    work_id         TEXT NOT NULL REFERENCES work(id) ON DELETE CASCADE,
    is_cover        INTEGER NOT NULL DEFAULT 0,
    confidence      REAL  -- cover→original match confidence (§3, R2), null for originals
);
CREATE INDEX IF NOT EXISTS idx_performance_of_recording ON performance_of(recording_id);
CREATE INDEX IF NOT EXISTS idx_performance_of_work ON performance_of(work_id);

CREATE TABLE IF NOT EXISTS wrote (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id   TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    work_id     TEXT NOT NULL REFERENCES work(id) ON DELETE CASCADE,
    role        TEXT  -- composer, lyricist
);
CREATE INDEX IF NOT EXISTS idx_wrote_person ON wrote(person_id);
CREATE INDEX IF NOT EXISTS idx_wrote_work ON wrote(work_id);

-- ── Override tables, kept separate, never merged (§8) ──────────────────

CREATE TABLE IF NOT EXISTS manual_overrides (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    field           TEXT NOT NULL,
    value           TEXT NOT NULL,
    reason          TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (entity_type, entity_id, field)
);

CREATE TABLE IF NOT EXISTS contributor_submissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    payload_json    TEXT NOT NULL,  -- raw KV["entity:{id}"] blob (§1.7)
    synced_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contributor_submissions_entity ON contributor_submissions(entity_type, entity_id);
