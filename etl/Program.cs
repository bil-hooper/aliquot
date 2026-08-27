using Aliquot.Etl.Bandcamp;
using Aliquot.Etl.Db;
using Aliquot.Etl.Http;

var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
var dbPath = Path.Combine(repoRoot, "etl", "aliquot.sqlite");
var httpCacheDir = Path.Combine(repoRoot, "etl", ".cache", "http");
var bandcampCacheDir = Path.Combine(repoRoot, "etl", ".cache", "bandcamp");

Console.WriteLine($"Opening SQLite store at {dbPath}");
using var db = SqliteBootstrapper.OpenAndMigrate(dbPath);
Console.WriteLine("Schema applied (5 node types, 8 edge types, slug/override/staging tables).");

if (Directory.Exists(bandcampCacheDir))
{
    Console.WriteLine($"Importing Bandcamp cache from {bandcampCacheDir} ...");
    var result = BandcampImporter.Import(db, bandcampCacheDir);
    Console.WriteLine(
        $"Bandcamp import done: {result.AlbumsLoaded} albums, {result.TracksLoaded} tracks -> " +
        $"{result.ReleasesUpserted} releases, {result.RecordingsUpserted} recordings, " +
        $"{result.ArtistsUpserted} distinct covering artists, {result.AppearsOnEdges} appears_on edges, " +
        $"{result.PerformedByEdges} performed_by edges.");
}
else
{
    Console.WriteLine($"No Bandcamp cache at {bandcampCacheDir} - run scripts/harvest-bandcamp.ps1 first. Skipping import.");
}

// MusicBrainz requires a descriptive User-Agent with contact info, and caps
// anonymous callers at 1 req/sec (§4). This is the shared HTTP path every
// source in the ETL should go through.
using var client = new CachedHttpClient(
    userAgent: "Aliquot-ETL/0.1 (+hotfussbook@gmail.com)",
    cacheDirectory: httpCacheDir,
    rateLimitInterval: TimeSpan.FromSeconds(1));

const string testUrl = "https://musicbrainz.org/ws/2/artist/?query=artist:Radiohead&fmt=json";
Console.WriteLine($"Fetching {testUrl}");
var body = await client.GetStringAsync(testUrl);
Console.WriteLine($"Received {body.Length} bytes (cached to disk for future runs).");
