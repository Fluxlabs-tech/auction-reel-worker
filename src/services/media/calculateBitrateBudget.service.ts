import {
  DEFAULT_MAX_REEL_BYTES,
  DEFAULT_AUDIO_BITRATE_KBPS,
  DEFAULT_REEL_CRF,
  MAX_VIDEO_BITRATE_CEILING_KBPS,
  MIN_VIDEO_BITRATE_FLOOR_KBPS,
} from '../../config/defaults';

export interface BitrateBudget {
  videoMaxrateKbps: number;
  bufsizeKbps: number;
  audioBitrateKbps: number;
  crf: number;
}

/**
 * Calculates constrained VBV bitrate limits for an auction reel or cut clip to ensure
 * the output file size strictly remains below maxBytes (defaulting to 15.0 MB for WhatsApp 16MB limit).
 *
 * @param durationSeconds Duration of the output video in seconds
 * @param maxBytes Target max file size in bytes (default 15.0 MB)
 * @returns BitrateBudget containing video maxrate, bufsize, audio bitrate, and CRF
 */
export const calculateBitrateBudgetService = (
  durationSeconds: number,
  maxBytes: number = DEFAULT_MAX_REEL_BYTES,
): BitrateBudget => {
  let dur: number;
  let totalBits: number;
  let totalBitrateBps: number;
  let audioKbps: number;
  let audioBitrateBps: number;
  let rawVideoBps: number;
  let videoKbps: number;
  let bufsizeKbps: number;

  try {
    dur = Math.max(1, Number(durationSeconds) || 30);
    totalBits = Math.max(1024 * 1024 * 8, Number(maxBytes) * 8);
    totalBitrateBps = Math.floor(totalBits / dur);

    // Audio rate selection: 128k standard, 96k if severely bit-constrained (< 700 kbps total)
    audioKbps = totalBitrateBps < 700000 ? 96 : DEFAULT_AUDIO_BITRATE_KBPS;
    audioBitrateBps = audioKbps * 1000;

    rawVideoBps = Math.max(0, totalBitrateBps - audioBitrateBps);
    videoKbps = Math.floor(rawVideoBps / 1000);

    // Clamp within bounds
    videoKbps = Math.min(
      MAX_VIDEO_BITRATE_CEILING_KBPS,
      Math.max(MIN_VIDEO_BITRATE_FLOOR_KBPS, videoKbps),
    );
    bufsizeKbps = Math.round(videoKbps * 2);

    return {
      videoMaxrateKbps: videoKbps,
      bufsizeKbps,
      audioBitrateKbps: audioKbps,
      crf: DEFAULT_REEL_CRF,
    };
  } catch (error: any) {
    console.error(
      '[calculateBitrateBudgetService] Error calculating bitrate budget:',
      error?.message || error,
      { durationSeconds, maxBytes },
    );
    return {
      videoMaxrateKbps: 1800,
      bufsizeKbps: 3600,
      audioBitrateKbps: 128,
      crf: 23,
    };
  }
};
