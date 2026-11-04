import { ReelThemeVersion } from '../../interfaces/theme.interface';

export interface ParsedAssColor {
  r: number;
  g: number;
  b: number;
  a: number;
  rHex: string;
  gHex: string;
  bHex: string;
  aHex: string;
}

export const parseColorToRgba = (
  colorStr: string,
  explicitAlpha0to255?: number,
): ParsedAssColor => {
  let r: number = 255;
  let g: number = 255;
  let b: number = 255;
  let a: number = 0;
  let clean: string;
  let m: RegExpMatchArray | null;
  let opacity: number;
  let rHex: string;
  let gHex: string;
  let bHex: string;
  let aHex: string;

  try {
    if (!colorStr) {
      return { r: 255, g: 255, b: 255, a: 0, rHex: 'FF', gHex: 'FF', bHex: 'FF', aHex: '00' };
    }

    if (colorStr.startsWith('rgba') || colorStr.startsWith('rgb')) {
      m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (m) {
        r = parseInt(m[1], 10);
        g = parseInt(m[2], 10);
        b = parseInt(m[3], 10);
        opacity = m[4] !== undefined ? parseFloat(m[4]) : 1.0;
        // In ASS: 0 is 100% opaque, 255 is 100% transparent
        a = Math.round((1 - opacity) * 255);
      }
    } else {
      clean = colorStr.replace('#', '').trim();
      if (clean.length === 6) {
        r = parseInt(clean.substring(0, 2), 16) || 0;
        g = parseInt(clean.substring(2, 4), 16) || 0;
        b = parseInt(clean.substring(4, 6), 16) || 0;
      } else if (clean.length === 8) {
        r = parseInt(clean.substring(0, 2), 16) || 0;
        g = parseInt(clean.substring(2, 4), 16) || 0;
        b = parseInt(clean.substring(4, 6), 16) || 0;
        opacity = (parseInt(clean.substring(6, 8), 16) || 255) / 255;
        a = Math.round((1 - opacity) * 255);
      } else if (clean.length === 3) {
        r = parseInt(clean[0] + clean[0], 16) || 0;
        g = parseInt(clean[1] + clean[1], 16) || 0;
        b = parseInt(clean[2] + clean[2], 16) || 0;
      }
    }

    if (explicitAlpha0to255 !== undefined) {
      a = Math.max(0, Math.min(255, explicitAlpha0to255));
    }

    rHex = Math.max(0, Math.min(255, r)).toString(16).padStart(2, '0').toUpperCase();
    gHex = Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0').toUpperCase();
    bHex = Math.max(0, Math.min(255, b)).toString(16).padStart(2, '0').toUpperCase();
    aHex = Math.max(0, Math.min(255, a)).toString(16).padStart(2, '0').toUpperCase();

    return { r, g, b, a, rHex, gHex, bHex, aHex };
  } catch (error: any) {
    console.error('[parseColorToRgba] Error parsing color:', colorStr, error?.message || error);
    return { r: 255, g: 255, b: 255, a: 0, rHex: 'FF', gHex: 'FF', bHex: 'FF', aHex: '00' };
  }
};

export const assStyleColor = (colorStr: string, explicitAlpha0to255?: number): string => {
  let parsed: ParsedAssColor;

  try {
    parsed = parseColorToRgba(colorStr, explicitAlpha0to255);
    // ASS Style Format: &HAABBGGRR
    return `&H${parsed.aHex}${parsed.bHex}${parsed.gHex}${parsed.rHex}`;
  } catch (error: any) {
    console.error(
      '[assStyleColor] Error formatting style color:',
      colorStr,
      error?.message || error,
    );
    return '&H00FFFFFF';
  }
};

export const assInlineColor = (colorStr: string): string => {
  let parsed: ParsedAssColor;

  try {
    parsed = parseColorToRgba(colorStr);
    // ASS inline \c format: &HBBGGRR&
    return `&H${parsed.bHex}${parsed.gHex}${parsed.rHex}&`;
  } catch (error: any) {
    console.error(
      '[assInlineColor] Error formatting inline color:',
      colorStr,
      error?.message || error,
    );
    return '&HFFFFFF&';
  }
};

export const assColor = (colorStr: string, explicitAlpha0to255?: number): string => {
  let parsed: ParsedAssColor;

  try {
    parsed = parseColorToRgba(colorStr, explicitAlpha0to255);
    // If alpha is present (>0 transparency), append \1a tag so \c${assColor(col)} sets both BGR and alpha
    if (parsed.a > 0) {
      return `&H${parsed.bHex}${parsed.gHex}${parsed.rHex}&\\1a&H${parsed.aHex}&`;
    }
    return `&H${parsed.bHex}${parsed.gHex}${parsed.rHex}&`;
  } catch (error: any) {
    console.error('[assColor] Error formatting color:', colorStr, error?.message || error);
    return '&HFFFFFF&';
  }
};

export const formatAssTime = (seconds: number): string => {
  let totalMs: number;
  let cs: number;
  let totalSec: number;
  let s: number;
  let m: number;
  let h: number;

  try {
    totalMs = Math.max(0, Math.round(seconds * 1000));
    cs = Math.floor((totalMs % 1000) / 10);
    totalSec = Math.floor(totalMs / 1000);
    s = totalSec % 60;
    m = Math.floor(totalSec / 60) % 60;
    h = Math.floor(totalSec / 3600);

    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  } catch (error: any) {
    console.error('[formatAssTime] Error formatting time:', seconds, error?.message || error);
    return '0:00:00.00';
  }
};

export const buildAssHeader = (theme: ReelThemeVersion, title: string = 'Auction Reel'): string => {
  let heavyFont: string;
  let ink: string;
  let white: string;
  let accent: string;
  let transparent: string;

  try {
    heavyFont = 'Poppins ExtraBold';
    ink = assStyleColor(theme.tokens.colors.ink);
    white = assStyleColor('#FFFFFF');
    accent = assStyleColor(theme.tokens.colors.accent);
    transparent = '&HFF000000';

    return `[Script Info]
Title: ${title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 720
PlayResY: 1280

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${heavyFont},32,${white},${white},${transparent},${transparent},-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Drawing,${heavyFont},10,${white},${white},${transparent},${transparent},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: HUD,${heavyFont},22,${white},${white},${ink},${transparent},-1,0,0,0,100,100,0,0,1,1,0,7,0,0,0,1
Style: BidCard,${heavyFont},44,${white},${white},${ink},${transparent},-1,0,0,0,100,100,0,0,1,1,0,7,0,0,0,1
Style: Captions,${heavyFont},${theme.components.captions.size},${white},${white},${assStyleColor(theme.tokens.colors.ink)},${assStyleColor(theme.tokens.colors.ink, 120)},-1,0,0,0,100,100,0,0,1,${theme.components.captions.stroke},4,2,30,30,${1280 - theme.components.captions.y},1
Style: Finale,${heavyFont},72,${accent},${accent},${ink},${transparent},-1,0,0,0,100,100,0,0,1,4,6,5,0,0,0,1
Style: Burst,${heavyFont},54,${white},${white},${ink},${transparent},-1,0,0,0,100,100,0,0,1,3,4,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  } catch (error: any) {
    console.error('[buildAssHeader] Error building ASS header:', error?.message || error);
    return '';
  }
};
