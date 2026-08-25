using Polly;
using Polly.Retry;

namespace Aliquot.Etl.Http;

/// <summary>
/// Fetches a URL through the disk cache first, then falls back to a rate-limited,
/// retrying HTTP call. This is the one path every ETL source (MusicBrainz, Discogs,
/// Wikidata, Bandcamp) should go through (§4, §8).
/// </summary>
public sealed class CachedHttpClient : IDisposable
{
    private readonly HttpClient _http;
    private readonly DiskResponseCache _cache;
    private readonly RateLimiter _rateLimiter;
    private readonly ResiliencePipeline _retryPipeline;

    public CachedHttpClient(string userAgent, string cacheDirectory, TimeSpan rateLimitInterval)
    {
        _http = new HttpClient();
        _http.DefaultRequestHeaders.UserAgent.ParseAdd(userAgent);
        _cache = new DiskResponseCache(cacheDirectory);
        _rateLimiter = new RateLimiter(rateLimitInterval);

        _retryPipeline = new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                MaxRetryAttempts = 4,
                BackoffType = DelayBackoffType.Exponential,
                Delay = TimeSpan.FromSeconds(1),
                ShouldHandle = new PredicateBuilder().Handle<HttpRequestException>(),
            })
            .Build();
    }

    public async Task<string> GetStringAsync(string url, CancellationToken cancellationToken = default)
    {
        var cached = await _cache.TryGetAsync(url, cancellationToken);
        if (cached is not null)
            return cached;

        var body = await _retryPipeline.ExecuteAsync(async ct =>
        {
            await _rateLimiter.WaitAsync(ct);
            using var response = await _http.GetAsync(url, ct);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync(ct);
        }, cancellationToken);

        await _cache.SetAsync(url, body, cancellationToken);
        return body;
    }

    public void Dispose() => _http.Dispose();
}
