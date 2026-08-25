namespace Aliquot.Etl.Http;

/// <summary>
/// Fixed-interval rate limiter — one permit released every <paramref name="interval"/>.
/// Used to hold MusicBrainz to 1 req/sec, Discogs to 60 req/min, etc. (§4).
/// </summary>
public sealed class RateLimiter(TimeSpan interval)
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private DateTime _nextAvailableUtc = DateTime.UtcNow;

    public async Task WaitAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var now = DateTime.UtcNow;
            var delay = _nextAvailableUtc - now;
            if (delay > TimeSpan.Zero)
                await Task.Delay(delay, cancellationToken);

            _nextAvailableUtc = DateTime.UtcNow + interval;
        }
        finally
        {
            _gate.Release();
        }
    }
}
