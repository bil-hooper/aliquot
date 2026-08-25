using Aliquot.Etl.Db;
using Aliquot.Etl.Http;

var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
var dbPath = Path.Combine(repoRoot, "etl", "aliquot.sqlite");
var cacheDir = Path.Combine(repoRoot, "etl", ".cache", "http");

Console.WriteLine($"Opening SQLite store at {dbPath}");
using var db = SqliteBootstrapper.OpenAndMigrate(dbPath);
Console.WriteLine("Schema applied (5 node types, 7 edge types, slug/override tables).");

// MusicBrainz requires a descriptive User-Agent with contact info, and caps
// anonymous callers at 1 req/sec (§4). This is the shared HTTP path every
// source in the ETL should go through.
using var client = new CachedHttpClient(
    userAgent: "Aliquot-ETL/0.1 (+hotfussbook@gmail.com)",
    cacheDirectory: cacheDir,
    rateLimitInterval: TimeSpan.FromSeconds(1));

const string testUrl = "https://musicbrainz.org/ws/2/artist/?query=artist:Radiohead&fmt=json";
Console.WriteLine($"Fetching {testUrl}");
var body = await client.GetStringAsync(testUrl);
Console.WriteLine($"Received {body.Length} bytes (cached to disk for future runs).");
