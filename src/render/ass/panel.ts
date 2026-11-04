import { formatAssTime, assInlineColor, parseColorToRgba } from './header';
import { buildRoundedRectPath } from './shapes';
import { assAlpha } from './alphaTag';

export interface PanelBorder {
  color: string;
  opacity: number;
  width: number;
}

export interface PanelShadow {
  opacity: number;
  blur: number;
  dy: number;
}

export interface PanelSpec {
  layer: number;
  t0: number;
  t1: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  r: number;
  fill: string;
  /** 0..1 — overrides any alpha carried by `fill` (e.g. rgba glass) */
  fillOpacity?: number;
  border?: PanelBorder | null;
  shadow?: PanelShadow | null;
  /** extra override tags applied to body and shadow alike (\fad, \t(..), \frz, scale pops) */
  tags?: string;
  /** slide in from (cx+dx, cy+dy) to (cx, cy) over `ms` */
  from?: { dx: number; dy: number; ms: number } | null;
}

export const GLASS_BORDER: PanelBorder = { color: '#FFFFFF', opacity: 0.16, width: 1.5 };
export const SOFT_SHADOW: PanelShadow = { opacity: 0.38, blur: 14, dy: 8 };

// Rounded-rect panel (glass card, pill, badge) drawn in local coordinates and anchored with \an5 at
// its centre, so scale / rotation animations pivot around the middle of the shape. Returns the soft
// drop-shadow line (when requested) followed by the body line, both on the same layer so ReadOrder
// keeps the shadow underneath.
export const buildPanelLines = (spec: PanelSpec): string[] => {
  let lines: string[] = [];
  let path: string;
  let t0Str: string;
  let t1Str: string;
  let fillTag: string;
  let fillAlpha: number;
  let borderTag: string;
  let extraTags: string;
  let posTag: string;
  let shadowPosTag: string;

  try {
    if (spec.t1 <= spec.t0 || spec.w <= 0 || spec.h <= 0) return lines;

    path = buildRoundedRectPath(spec.w, spec.h, spec.r, 0, 0);
    t0Str = formatAssTime(spec.t0);
    t1Str = formatAssTime(spec.t1);
    extraTags = spec.tags || '';

    fillAlpha =
      spec.fillOpacity !== undefined
        ? Math.round((1 - Math.max(0, Math.min(1, spec.fillOpacity))) * 255)
        : parseColorToRgba(spec.fill).a;
    fillTag = `\\c${assInlineColor(spec.fill)}\\1a&H${fillAlpha.toString(16).padStart(2, '0').toUpperCase()}&`;

    borderTag = spec.border
      ? `\\bord${spec.border.width}\\3c${assInlineColor(spec.border.color)}\\3a${assAlpha(spec.border.opacity)}`
      : '\\bord0';

    if (spec.from) {
      posTag = `\\move(${Math.round(spec.cx + spec.from.dx)},${Math.round(spec.cy + spec.from.dy)},${Math.round(spec.cx)},${Math.round(spec.cy)},0,${spec.from.ms})`;
      shadowPosTag = spec.shadow
        ? `\\move(${Math.round(spec.cx + spec.from.dx)},${Math.round(spec.cy + spec.from.dy + spec.shadow.dy)},${Math.round(spec.cx)},${Math.round(spec.cy + spec.shadow.dy)},0,${spec.from.ms})`
        : '';
    } else {
      posTag = `\\pos(${Math.round(spec.cx)},${Math.round(spec.cy)})`;
      shadowPosTag = spec.shadow
        ? `\\pos(${Math.round(spec.cx)},${Math.round(spec.cy + spec.shadow.dy)})`
        : '';
    }

    if (spec.shadow) {
      lines.push(
        `Dialogue: ${spec.layer},${t0Str},${t1Str},Drawing,,0,0,0,,{${shadowPosTag}\\an5\\p1\\c&H000000&\\1a${assAlpha(spec.shadow.opacity)}\\bord0\\shad0\\blur${spec.shadow.blur}${extraTags}}${path}`,
      );
    }

    lines.push(
      `Dialogue: ${spec.layer},${t0Str},${t1Str},Drawing,,0,0,0,,{${posTag}\\an5\\p1${fillTag}${borderTag}\\shad0${extraTags}}${path}`,
    );

    return lines;
  } catch (error: any) {
    console.error('[buildPanelLines] Error:', error?.response?.data || error?.message || error);
    return [];
  }
};
