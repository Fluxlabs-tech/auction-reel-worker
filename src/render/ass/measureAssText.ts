import path from 'path';
import { measureTextService } from '../../services/render/measureText.service';

export type AssFontWeight = 'heavy' | 'bold';

const FONT_FILES: Record<AssFontWeight, string> = {
  heavy: 'fonts/Poppins-ExtraBold.ttf',
  bold: 'fonts/Poppins-Bold.ttf',
};

// Width in script pixels of `text` set at `emPx` (design font size, not \fs), including \fsp spacing.
// Used to size pills and cards to their content instead of guessing from character counts.
export const measureAssTextWidth = (
  text: string,
  emPx: number,
  weight: AssFontWeight = 'heavy',
  letterSpacing: number = 0,
): number => {
  let fontPath: string;
  let measured: { width: number; height: number };
  let charCount: number;

  try {
    fontPath = path.resolve(process.cwd(), FONT_FILES[weight]);
    measured = measureTextService(text, emPx, fontPath);
    charCount = Array.from(text).length;
    return Math.round(measured.width + letterSpacing * charCount);
  } catch (error: any) {
    console.error('[measureAssTextWidth] Error:', error?.response?.data || error?.message || error);
    return Math.round(text.length * emPx * 0.62);
  }
};
