using System.Text.Json.Serialization;

namespace Aliquot.Etl.Bandcamp;

/// <summary>Shape of the `data-tralbum` blob embedded in every Bandcamp album page (§5 Sprint 1 R1 spike).</summary>
public sealed class BandcampAlbum
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("current")]
    public BandcampAlbumCurrent? Current { get; set; }

    [JsonPropertyName("album_release_date")]
    public string? AlbumReleaseDate { get; set; }

    [JsonPropertyName("trackinfo")]
    public List<BandcampTrack> TrackInfo { get; set; } = [];

    [JsonPropertyName("url")]
    public string? Url { get; set; }
}

public sealed class BandcampAlbumCurrent
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("release_date")]
    public string? ReleaseDate { get; set; }
}

public sealed class BandcampTrack
{
    [JsonPropertyName("track_id")]
    public long TrackId { get; set; }

    [JsonPropertyName("track_num")]
    public int? TrackNum { get; set; }

    [JsonPropertyName("artist")]
    public string? Artist { get; set; }

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("duration")]
    public double? Duration { get; set; }

    [JsonPropertyName("file")]
    public BandcampTrackFile? File { get; set; }
}

public sealed class BandcampTrackFile
{
    [JsonPropertyName("mp3-128")]
    public string? Mp3128 { get; set; }
}
