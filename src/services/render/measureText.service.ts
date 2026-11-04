import fs from 'fs';
import path from 'path';
import fontkit from 'fontkit';

const fontCache: Map<string, any> = new Map();

export const measureTextService = (
  text: string,
  fontSize: number,
  fontPath?: string,
): { width: number; height: number } => {
  let font: any;
  let run: any;
  let totalAdvance: number;
  let width: number;
  let height: number;
  let resolvedFontPath: string;

  try {
    if (!fontPath || !fs.existsSync(fontPath)) {
      resolvedFontPath = path.resolve(process.cwd(), 'fonts/Poppins-ExtraBold.ttf');
      if (fs.existsSync(resolvedFontPath)) {
        fontPath = resolvedFontPath;
      }
    }

    if (fontPath && fs.existsSync(fontPath)) {
      if (!fontCache.has(fontPath)) {
        font = fontkit.openSync(fontPath);
        fontCache.set(fontPath, font);
      } else {
        font = fontCache.get(fontPath);
      }

      run = font.layout(text);
      totalAdvance = 0;
      for (const glyph of run.glyphs) {
        totalAdvance += glyph.advanceWidth;
      }

      width = (totalAdvance / font.unitsPerEm) * fontSize;
      height = fontSize * 1.2;

      return {
        width: Math.round(width),
        height: Math.round(height),
      };
    }

    // Accurate geometric fallback for Poppins bold/extrabold
    // Average character width for Poppins Bold is ~0.62 of font size
    width = text.length * fontSize * 0.62;
    height = fontSize * 1.2;

    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  } catch (error: any) {
    console.warn(
      '[measureTextService] Fontkit measurement warning, using fallback:',
      error?.message || error,
    );
    return {
      width: Math.round(text.length * fontSize * 0.62),
      height: Math.round(fontSize * 1.2),
    };
  }
};
