import { parsePlaylistService } from '../../src/services/media/parsePlaylist.service';

describe('parsePlaylistService', () => {
  it('should parse simple HLS playlist without discontinuities', () => {
    const m3u8 = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:2.000,
segment_000.ts
#EXTINF:2.000,
segment_001.ts
#EXT-X-ENDLIST`;

    const segs = parsePlaylistService(m3u8);
    expect(segs).toHaveLength(2);
    expect(segs[0].key).toBe('segment_000.ts');
    expect(segs[0].dur).toBe(2.0);
    expect(segs[0].media_start).toBe(0);
    expect(segs[0].group).toBe(0);
    expect(segs[0].pdt).toBeNull();

    expect(segs[1].key).toBe('segment_001.ts');
    expect(segs[1].dur).toBe(2.0);
    expect(segs[1].media_start).toBe(2.0);
    expect(segs[1].group).toBe(0);
  });

  it('should increment discontinuity group on #EXT-X-DISCONTINUITY', () => {
    const m3u8 = `#EXTM3U
#EXTINF:2.000,
seg_0.ts
#EXT-X-DISCONTINUITY
#EXTINF:2.000,
seg_1.ts`;

    const segs = parsePlaylistService(m3u8);
    expect(segs).toHaveLength(2);
    expect(segs[0].group).toBe(0);
    expect(segs[1].group).toBe(1);
    expect(segs[1].media_start).toBe(2.0);
  });

  it('should parse #EXT-X-PROGRAM-DATE-TIME tags accurately', () => {
    const m3u8 = `#EXTM3U
#EXT-X-PROGRAM-DATE-TIME:2026-10-29T15:26:47.118Z
#EXTINF:2.000,
seg_0.ts
#EXTINF:2.000,
seg_1.ts`;

    const segs = parsePlaylistService(m3u8);
    expect(segs).toHaveLength(2);
    expect(segs[0].pdt).toEqual(new Date('2026-10-29T15:26:47.118Z'));
    expect(segs[1].pdt).toBeNull();
  });
});
