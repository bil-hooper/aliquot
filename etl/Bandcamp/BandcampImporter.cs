using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;

namespace Aliquot.Etl.Bandcamp;

public sealed record BandcampImportResult(
    int AlbumsLoaded,
    int TracksLoaded,
    int ReleasesUpserted,
    int RecordingsUpserted,
    int ArtistsUpserted,
    int AppearsOnEdges,
    int PerformedByEdges);

/// <summary>
/// Loads the harvested Bandcamp JSON cache (scripts/harvest-bandcamp.ps1's output) into SQLite:
/// first untransformed into the bandcamp_*_raw staging tables (§5 Sprint 2 - "land what Bandcamp
/// gives you raw"), then normalized into cover releases -> cover recordings -> covering artists.
/// </summary>
public static partial class BandcampImporter
{
    public static BandcampImportResult Import(SqliteConnection connection, string cacheDirectory)
    {
        var albums = LoadFromCache(cacheDirectory);

        using var transaction = connection.BeginTransaction();

        foreach (var (album, rawJson) in albums)
            UpsertRawAlbum(connection, transaction, album, rawJson);

        int releasesUpserted = 0, recordingsUpserted = 0, artistsUpserted = 0, appearsOnEdges = 0, performedByEdges = 0;
        var seenArtistIds = new HashSet<string>();

        foreach (var (album, _) in albums)
        {
            UpsertRelease(connection, transaction, album);
            releasesUpserted++;

            foreach (var track in album.TrackInfo)
            {
                UpsertRecording(connection, transaction, track);
                recordingsUpserted++;

                UpsertAppearsOn(connection, transaction, album, track);
                appearsOnEdges++;

                var artistName = track.Artist?.Trim();
                if (!string.IsNullOrEmpty(artistName))
                {
                    var artistId = ArtistId(artistName);
                    if (seenArtistIds.Add(artistId))
                    {
                        UpsertArtist(connection, transaction, artistId, artistName);
                        artistsUpserted++;
                    }
                    UpsertPerformedBy(connection, transaction, artistId, RecordingId(track.TrackId));
                    performedByEdges++;
                }
            }
        }

        transaction.Commit();

        return new BandcampImportResult(
            AlbumsLoaded: albums.Count,
            TracksLoaded: albums.Sum(a => a.album.TrackInfo.Count),
            ReleasesUpserted: releasesUpserted,
            RecordingsUpserted: recordingsUpserted,
            ArtistsUpserted: artistsUpserted,
            AppearsOnEdges: appearsOnEdges,
            PerformedByEdges: performedByEdges);
    }

    private static List<(BandcampAlbum album, string rawJson)> LoadFromCache(string cacheDirectory)
    {
        var result = new List<(BandcampAlbum, string)>();

        foreach (var path in Directory.EnumerateFiles(cacheDirectory, "*.json").OrderBy(p => p))
        {
            var rawJson = File.ReadAllText(path).TrimStart('﻿');
            if (string.IsNullOrWhiteSpace(rawJson))
                continue; // guards against the empty ".json" artifact a bug once left behind

            var album = JsonSerializer.Deserialize<BandcampAlbum>(rawJson)
                ?? throw new InvalidOperationException($"Failed to parse {path}");
            result.Add((album, rawJson));
        }

        return result;
    }

    // ── ID scheme ───────────────────────────────────────────────────────
    // Stable, deterministic ids derived from Bandcamp's own identifiers so
    // re-running the importer is idempotent. `slug` (§1.8's sticky public
    // slug) is deliberately left null here - that's assigned in Sprint 3/4,
    // not during raw normalization.

    public static string ReleaseId(long albumId) => $"release/bandcamp/{albumId}";
    public static string RecordingId(long trackId) => $"recording/bandcamp/{trackId}";

    public static string ArtistId(string name) => $"artist/bandcamp/{Slugify(name)}";

    private static string Slugify(string value)
    {
        var lowered = value.Trim().ToLowerInvariant();
        var hyphenated = NonAlphanumericRun().Replace(lowered, "-");
        return hyphenated.Trim('-');
    }

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonAlphanumericRun();

    // ── Raw staging ─────────────────────────────────────────────────────

    private static void UpsertRawAlbum(SqliteConnection connection, SqliteTransaction transaction, BandcampAlbum album, string rawJson)
    {
        var slug = SlugFromUrl(album.Url) ?? album.Id.ToString(CultureInfo.InvariantCulture);
        var title = album.Current?.Title ?? slug;
        var releaseDate = album.Current?.ReleaseDate ?? album.AlbumReleaseDate;

        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            INSERT INTO bandcamp_album_raw (album_id, slug, title, release_date, raw_json)
            VALUES ($albumId, $slug, $title, $releaseDate, $rawJson)
            ON CONFLICT(album_id) DO UPDATE SET
                slug = excluded.slug,
                title = excluded.title,
                release_date = excluded.release_date,
                raw_json = excluded.raw_json,
                harvested_at = datetime('now');
            """;
        command.Parameters.AddWithValue("$albumId", album.Id);
        command.Parameters.AddWithValue("$slug", slug);
        command.Parameters.AddWithValue("$title", title);
        command.Parameters.AddWithValue("$releaseDate", (object?)releaseDate ?? DBNull.Value);
        command.Parameters.AddWithValue("$rawJson", rawJson);
        command.ExecuteNonQuery();

        foreach (var track in album.TrackInfo)
        {
            using var trackCommand = connection.CreateCommand();
            trackCommand.Transaction = transaction;
            trackCommand.CommandText = """
                INSERT INTO bandcamp_track_raw (track_id, album_id, track_num, artist, title, duration_seconds, mp3_128_url)
                VALUES ($trackId, $albumId, $trackNum, $artist, $title, $duration, $mp3Url)
                ON CONFLICT(track_id) DO UPDATE SET
                    album_id = excluded.album_id,
                    track_num = excluded.track_num,
                    artist = excluded.artist,
                    title = excluded.title,
                    duration_seconds = excluded.duration_seconds,
                    mp3_128_url = excluded.mp3_128_url;
                """;
            trackCommand.Parameters.AddWithValue("$trackId", track.TrackId);
            trackCommand.Parameters.AddWithValue("$albumId", album.Id);
            trackCommand.Parameters.AddWithValue("$trackNum", (object?)track.TrackNum ?? DBNull.Value);
            trackCommand.Parameters.AddWithValue("$artist", (object?)track.Artist ?? DBNull.Value);
            trackCommand.Parameters.AddWithValue("$title", track.Title);
            trackCommand.Parameters.AddWithValue("$duration", (object?)track.Duration ?? DBNull.Value);
            trackCommand.Parameters.AddWithValue("$mp3Url", (object?)track.File?.Mp3128 ?? DBNull.Value);
            trackCommand.ExecuteNonQuery();
        }
    }

    private static string? SlugFromUrl(string? url)
    {
        if (string.IsNullOrEmpty(url)) return null;
        var marker = "/album/";
        var index = url.IndexOf(marker, StringComparison.Ordinal);
        return index < 0 ? null : url[(index + marker.Length)..].Trim('/');
    }

    // ── Normalization ───────────────────────────────────────────────────

    private static void UpsertRelease(SqliteConnection connection, SqliteTransaction transaction, BandcampAlbum album)
    {
        var title = album.Current?.Title ?? $"Untitled ({album.Id})";
        var releaseDate = ParseBandcampDate(album.Current?.ReleaseDate ?? album.AlbumReleaseDate);

        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            INSERT INTO release (id, title, kind, release_date)
            VALUES ($id, $title, 'cover', $releaseDate)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                release_date = excluded.release_date,
                updated_at = datetime('now');
            """;
        command.Parameters.AddWithValue("$id", ReleaseId(album.Id));
        command.Parameters.AddWithValue("$title", title);
        command.Parameters.AddWithValue("$releaseDate", (object?)releaseDate ?? DBNull.Value);
        command.ExecuteNonQuery();
    }

    private static void UpsertRecording(SqliteConnection connection, SqliteTransaction transaction, BandcampTrack track)
    {
        var title = CleanTrackTitle(track.Title, track.Artist);

        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            INSERT INTO recording (id, title, kind, duration_seconds, audio_source_provider, audio_source_ref)
            VALUES ($id, $title, 'cover', $duration, 'bandcamp', $ref)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                duration_seconds = excluded.duration_seconds,
                audio_source_provider = excluded.audio_source_provider,
                audio_source_ref = excluded.audio_source_ref,
                updated_at = datetime('now');
            """;
        command.Parameters.AddWithValue("$id", RecordingId(track.TrackId));
        command.Parameters.AddWithValue("$title", title);
        command.Parameters.AddWithValue("$duration", (object?)track.Duration ?? DBNull.Value);
        command.Parameters.AddWithValue("$ref", track.TrackId.ToString(CultureInfo.InvariantCulture));
        command.ExecuteNonQuery();
    }

    /// <summary>Bandcamp's own track titles duplicate the artist as a prefix (e.g. "Motorcade One - King of the Hill").</summary>
    private static string CleanTrackTitle(string rawTitle, string? artist)
    {
        if (!string.IsNullOrEmpty(artist))
        {
            var prefix = $"{artist} - ";
            if (rawTitle.StartsWith(prefix, StringComparison.Ordinal))
                return rawTitle[prefix.Length..];
        }
        return rawTitle;
    }

    private static void UpsertArtist(SqliteConnection connection, SqliteTransaction transaction, string artistId, string name)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            INSERT INTO artist (id, name, role)
            VALUES ($id, $name, 'covering')
            ON CONFLICT(id) DO UPDATE SET
                updated_at = datetime('now');
            """;
        // Deliberately no UPDATE of `name` or `role` on conflict: role could have been
        // hand-promoted to 'both' by a manual override, and a re-import must never clobber that.
        command.Parameters.AddWithValue("$id", artistId);
        command.Parameters.AddWithValue("$name", name);
        command.ExecuteNonQuery();
    }

    private static void UpsertAppearsOn(SqliteConnection connection, SqliteTransaction transaction, BandcampAlbum album, BandcampTrack track)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            INSERT INTO appears_on (recording_id, release_id, track_number)
            SELECT $recordingId, $releaseId, $trackNumber
            WHERE NOT EXISTS (
                SELECT 1 FROM appears_on WHERE recording_id = $recordingId AND release_id = $releaseId
            );
            """;
        command.Parameters.AddWithValue("$recordingId", RecordingId(track.TrackId));
        command.Parameters.AddWithValue("$releaseId", ReleaseId(album.Id));
        command.Parameters.AddWithValue("$trackNumber", (object?)track.TrackNum ?? DBNull.Value);
        command.ExecuteNonQuery();
    }

    private static void UpsertPerformedBy(SqliteConnection connection, SqliteTransaction transaction, string artistId, string recordingId)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            INSERT OR IGNORE INTO performed_by (artist_id, recording_id)
            VALUES ($artistId, $recordingId);
            """;
        command.Parameters.AddWithValue("$artistId", artistId);
        command.Parameters.AddWithValue("$recordingId", recordingId);
        command.ExecuteNonQuery();
    }

    /// <summary>Bandcamp dates look like "30 Apr 2016 00:00:00 GMT". Returns an ISO 8601 date, or the raw string if unparseable.</summary>
    private static string? ParseBandcampDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        if (DateTime.TryParseExact(raw, "dd MMM yyyy HH:mm:ss 'GMT'", CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal, out var parsed))
        {
            return parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        Console.Error.WriteLine($"[warn] could not parse Bandcamp date '{raw}', storing raw");
        return raw;
    }
}
