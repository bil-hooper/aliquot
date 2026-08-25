using System.Security.Cryptography;
using System.Text;

namespace Aliquot.Etl.Http;

/// <summary>
/// Disk-backed cache keyed by request URL (§4, §8: "cache every response to disk
/// so re-runs are instant"). One file per URL, named by its SHA-256 hash so
/// query strings and odd characters never touch the filesystem.
/// </summary>
public sealed class DiskResponseCache(string cacheDirectory)
{
    private readonly string _cacheDirectory = cacheDirectory;

    public async Task<string?> TryGetAsync(string url, CancellationToken cancellationToken = default)
    {
        var path = PathFor(url);
        return File.Exists(path)
            ? await File.ReadAllTextAsync(path, cancellationToken)
            : null;
    }

    public async Task SetAsync(string url, string body, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(_cacheDirectory);
        await File.WriteAllTextAsync(PathFor(url), body, cancellationToken);
    }

    private string PathFor(string url)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(url)));
        return Path.Combine(_cacheDirectory, $"{hash}.json");
    }
}
