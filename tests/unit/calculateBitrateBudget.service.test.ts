import {
  calculateBitrateBudgetService,
  BitrateBudget,
} from '../../src/services/media/calculateBitrateBudget.service';
import {
  DEFAULT_MAX_REEL_BYTES,
  MAX_VIDEO_BITRATE_CEILING_KBPS,
  MIN_VIDEO_BITRATE_FLOOR_KBPS,
  DEFAULT_AUDIO_BITRATE_KBPS,
} from '../../src/config/defaults';

describe('calculateBitrateBudgetService', () => {
  it('should clamp video bitrate to ceiling for short videos (15s)', () => {
    const budget: BitrateBudget = calculateBitrateBudgetService(15);

    expect(budget.videoMaxrateKbps).toBe(MAX_VIDEO_BITRATE_CEILING_KBPS);
    expect(budget.bufsizeKbps).toBe(MAX_VIDEO_BITRATE_CEILING_KBPS * 2);
    expect(budget.audioBitrateKbps).toBe(DEFAULT_AUDIO_BITRATE_KBPS);
    expect(budget.crf).toBe(23);
  });

  it('should calculate budget matching 15MB limit for 60s video', () => {
    const budget: BitrateBudget = calculateBitrateBudgetService(60, DEFAULT_MAX_REEL_BYTES);

    // 15 MB = 125,829,120 bits. In 60s = 2,097,152 bps. Minus 128,000 audio = 1,969 kbps video.
    expect(budget.videoMaxrateKbps).toBe(1969);
    expect(budget.bufsizeKbps).toBe(1969 * 2);
    expect(budget.audioBitrateKbps).toBe(128);

    // Estimated total bytes must be strictly <= DEFAULT_MAX_REEL_BYTES
    const totalBps = (budget.videoMaxrateKbps + budget.audioBitrateKbps) * 1000;
    const estimatedBytes = (totalBps * 60) / 8;
    expect(estimatedBytes).toBeLessThanOrEqual(DEFAULT_MAX_REEL_BYTES);
  });

  it('should scale down bitrate for longer videos (120s)', () => {
    const budget: BitrateBudget = calculateBitrateBudgetService(120);

    // 15 MB in 120s = 1,048,576 bps. Minus 128k = 920 kbps.
    expect(budget.videoMaxrateKbps).toBe(920);
    expect(budget.bufsizeKbps).toBe(1840);
    expect(budget.audioBitrateKbps).toBe(128);

    const totalBps = (budget.videoMaxrateKbps + budget.audioBitrateKbps) * 1000;
    const estimatedBytes = (totalBps * 120) / 8;
    expect(estimatedBytes).toBeLessThanOrEqual(DEFAULT_MAX_REEL_BYTES);
  });

  it('should clamp video bitrate to floor and select 96k audio for very long videos (300s)', () => {
    const budget: BitrateBudget = calculateBitrateBudgetService(300);

    expect(budget.videoMaxrateKbps).toBe(MIN_VIDEO_BITRATE_FLOOR_KBPS);
    expect(budget.audioBitrateKbps).toBe(96);
    expect(budget.bufsizeKbps).toBe(MIN_VIDEO_BITRATE_FLOOR_KBPS * 2);
  });

  it('should handle zero, negative, or invalid durations safely', () => {
    const b0 = calculateBitrateBudgetService(0);
    expect(b0.videoMaxrateKbps).toBeGreaterThanOrEqual(MIN_VIDEO_BITRATE_FLOOR_KBPS);

    const bNeg = calculateBitrateBudgetService(-10);
    expect(bNeg.videoMaxrateKbps).toBeGreaterThanOrEqual(MIN_VIDEO_BITRATE_FLOOR_KBPS);

    const bNaN = calculateBitrateBudgetService(NaN);
    expect(bNaN.videoMaxrateKbps).toBeGreaterThanOrEqual(MIN_VIDEO_BITRATE_FLOOR_KBPS);
  });

  it('should respect custom maxBytes target', () => {
    const customMax = 10 * 1024 * 1024; // 10 MB
    const budget = calculateBitrateBudgetService(60, customMax);

    // 10 MB in 60s = 1,398,101 bps. Minus 128k = 1270 kbps.
    expect(budget.videoMaxrateKbps).toBe(1270);
    const totalBps = (budget.videoMaxrateKbps + budget.audioBitrateKbps) * 1000;
    const estimatedBytes = (totalBps * 60) / 8;
    expect(estimatedBytes).toBeLessThanOrEqual(customMax);
  });
});
