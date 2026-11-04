// Converts a 0..1 opacity into an ASS alpha value (&H00& = opaque, &HFF& = invisible).
export const assAlpha = (opacity: number): string => {
  let clamped: number;
  let alpha: number;

  try {
    clamped = Math.max(0, Math.min(1, opacity));
    alpha = Math.round((1 - clamped) * 255);
    return `&H${alpha.toString(16).padStart(2, '0').toUpperCase()}&`;
  } catch (error: any) {
    console.error('[assAlpha] Error:', error?.response?.data || error?.message || error);
    return '&H00&';
  }
};
