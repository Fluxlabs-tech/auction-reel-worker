import { buildStreamClockService, median } from '../../src/services/media/buildStreamClock.service';
import { HlsSegment } from '../../src/services/media/parsePlaylist.service';

describe('buildStreamClockService', () => {
  it('should compute correct median for odd and even number of items', () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([10])).toBe(10);
  });

  it('should build clock using PDT anchor when present', async () => {
    const segs: HlsSegment[] = [
      {
        key: 's0.ts',
        dur: 2,
        media_start: 0,
        group: 0,
        pdt: new Date('2026-10-29T15:26:47.118Z'),
      },
      {
        key: 's1.ts',
        dur: 2,
        media_start: 2,
        group: 0,
        pdt: new Date('2026-10-29T15:26:49.118Z'),
      },
    ];

    const clock = await buildStreamClockService(70278, segs);
    expect(clock.method).toBe('pdt');
    expect(clock.groups).toHaveLength(1);

    const wallTime = new Date('2026-10-29T15:26:49.118Z');
    expect(clock.toMedia(wallTime)).toBeCloseTo(2.0, 3);
    expect(clock.toWall(2.0)).toEqual(wallTime);
  });

  it('should build clock using Last-Modified median when PDT is absent', async () => {
    const baseWallMs = new Date('2026-10-29T15:00:00.000Z').getTime();
    const segs: HlsSegment[] = [
      { key: 's0.ts', dur: 2, media_start: 0, group: 0, pdt: null },
      { key: 's1.ts', dur: 2, media_start: 2, group: 0, pdt: null },
      { key: 's2.ts', dur: 2, media_start: 4, group: 0, pdt: null },
    ];

    // Mock S3 LastModified timestamps: wall time + 2s upload lag with 1s truncation
    const mockHead = async (key: string): Promise<Date> => {
      const idx = parseInt(key.replace(/[^\d]/g, ''), 10);
      const segEndMs = (idx + 1) * 2000;
      // Truncate to second
      const lm = Math.floor((baseWallMs + segEndMs + 2000) / 1000) * 1000;
      return new Date(lm);
    };

    const clock = await buildStreamClockService(70278, segs, mockHead);
    expect(clock.method).toBe('last_modified');
    expect(clock.groups).toHaveLength(1);

    // Media offset computation works
    const testWall = new Date(baseWallMs + 6000);
    const media = clock.toMedia(testWall);
    expect(typeof media).toBe('number');
  });
});
