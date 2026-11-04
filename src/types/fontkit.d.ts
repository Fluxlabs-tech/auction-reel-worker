declare module 'fontkit' {
  export interface FontGlyph {
    id: number;
    codePoints: number[];
    advanceWidth: number;
  }

  export interface GlyphRun {
    glyphs: FontGlyph[];
    positions: Array<{ xAdvance: number; yAdvance: number }>;
  }

  export interface Font {
    unitsPerEm: number;
    ascent: number;
    descent: number;
    layout(text: string): GlyphRun;
    hasGlyphForCodePoint(codePoint: number): boolean;
  }

  export function openSync(path: string): Font;
  export function open(path: string, callback: (err: any, font: Font) => void): void;
}
