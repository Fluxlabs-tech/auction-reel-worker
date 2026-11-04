import { ReelTimeline } from '../../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../../interfaces/theme.interface';
import { formatAssTime, assInlineColor } from '../header';
import { buildCirclePath } from '../shapes';
import { assFade } from '../easing';
import { assFontSize } from '../fontSize';
import { assTextCenterY } from '../textCenterY';
import { assAlpha } from '../alphaTag';
import { measureAssTextWidth } from '../measureAssText';
import { buildPanelLines, GLASS_BORDER, SOFT_SHADOW } from '../panel';

const MARGIN_X = 28;
const PILL_H = 46;
const LABEL_EM = 16;
const LABEL_SPACING = 1.5;

// Top bar: lot counter pill (left) and the auction status badge (right): LIVE -> BIDDING CLOSED -> SOLD.
export const buildHudLines = (tl: ReelTimeline, theme: ReelThemeVersion): string[] => {
  let lines: string[] = [];
  let hud: ReelThemeVersion['components']['hud'];
  let canvasW: number;
  let rightEdge: number;
  let pillCy: number;
  let textY: number;
  let lotText: string;
  let lotW: number;
  let tPill0: number;
  let tLive: number;
  let tClose: number;
  let tResult: number;
  let tEnd: number;
  let liveTextW: number;
  let liveW: number;
  let dotX: number;
  let sec: number;
  let pulseT0: number;
  let pulseT1: number;
  let closedText: string;
  let closedW: number;
  let soldText: string;
  let soldW: number;
  let soldFill: string;

  try {
    hud = theme.components.hud;
    if (!hud || !hud.enabled) return lines;

    canvasW = theme.canvas?.w || 720;
    rightEdge = canvasW - MARGIN_X;
    pillCy = hud.y + PILL_H / 2;
    textY = assTextCenterY(pillCy, LABEL_EM);
    tLive = tl.live.t;
    tClose = tl.close.t;
    tResult = tl.result.t;
    tEnd = tl.end;

    // 1. Lot counter pill (top-left), sized to its label
    lotText = hud.lot_label
      .replace('{lot_no}', String(tl.meta.lot_no))
      .replace('{lot_total}', String(tl.meta.lot_total));
    lotW = measureAssTextWidth(lotText, LABEL_EM, 'heavy', LABEL_SPACING) + 40;
    tPill0 = Math.max(0, Math.min(tl.intro.t0, tLive));

    lines.push(
      ...buildPanelLines({
        layer: 1,
        t0: tPill0,
        t1: tEnd,
        cx: MARGIN_X + lotW / 2,
        cy: pillCy,
        w: lotW,
        h: PILL_H,
        r: PILL_H / 2,
        fill: theme.tokens.colors.glass,
        border: GLASS_BORDER,
        shadow: SOFT_SHADOW,
        tags: assFade(250, 0),
      }),
    );
    lines.push(
      `Dialogue: 2,${formatAssTime(tPill0)},${formatAssTime(tEnd)},HUD,,0,0,0,,{\\pos(${Math.round(MARGIN_X + lotW / 2)},${textY})\\an5\\bord0\\shad0\\c${assInlineColor('#FFFFFF')}\\fs${assFontSize(LABEL_EM)}\\fsp${LABEL_SPACING}${assFade(250, 0)}}${lotText}`,
    );

    // 2. LIVE badge [live.t -> close.t] with a pulsing dot and a "ping" ring every second
    if (tClose > tLive) {
      liveTextW = measureAssTextWidth('LIVE', LABEL_EM, 'heavy', 2);
      liveW = 18 + 12 + 10 + liveTextW + 18;
      dotX = rightEdge - liveW + 18 + 6;

      lines.push(
        ...buildPanelLines({
          layer: 1,
          t0: tLive,
          t1: tClose,
          cx: rightEdge - liveW / 2,
          cy: pillCy,
          w: liveW,
          h: PILL_H,
          r: PILL_H / 2,
          fill: theme.tokens.colors.live,
          shadow: SOFT_SHADOW,
          tags: `\\fscx70\\fscy70\\t(0,180,\\fscx100\\fscy100)${assFade(120, 0)}`,
        }),
      );
      lines.push(
        `Dialogue: 2,${formatAssTime(tLive)},${formatAssTime(tClose)},HUD,,0,0,0,,{\\pos(${dotX + 6 + 10},${textY})\\an4\\bord0\\shad0\\c${assInlineColor('#FFFFFF')}\\fs${assFontSize(LABEL_EM)}\\fsp2${assFade(200, 0)}}LIVE`,
      );

      for (sec = 0; tLive + sec < tClose; sec++) {
        pulseT0 = tLive + sec;
        pulseT1 = Math.min(tClose, pulseT0 + 1);
        lines.push(
          `Dialogue: 2,${formatAssTime(pulseT0)},${formatAssTime(pulseT1)},Drawing,,0,0,0,,{\\pos(${dotX},${pillCy})\\an5\\p1\\c${assInlineColor('#FFFFFF')}\\bord0\\shad0\\t(0,500,\\1a&H70&)\\t(500,1000,\\1a&H00&)}${buildCirclePath(6, 6, 6)}`,
        );
        lines.push(
          `Dialogue: 2,${formatAssTime(pulseT0)},${formatAssTime(Math.min(pulseT1, pulseT0 + 0.9))},Drawing,,0,0,0,,{\\pos(${dotX},${pillCy})\\an5\\p1\\1a&HFF&\\bord2\\3c${assInlineColor('#FFFFFF')}\\3a${assAlpha(0.8)}\\shad0\\t(0,900,\\fscx260\\fscy260\\3a&HFF&)}${buildCirclePath(6, 6, 6)}`,
        );
      }
    }

    // 3. BIDDING CLOSED badge [close.t -> result.t]
    if (tResult > tClose) {
      closedText = 'BIDDING CLOSED';
      closedW = measureAssTextWidth(closedText, LABEL_EM, 'heavy', LABEL_SPACING) + 40;
      lines.push(
        ...buildPanelLines({
          layer: 1,
          t0: tClose,
          t1: tResult,
          cx: rightEdge - closedW / 2,
          cy: pillCy,
          w: closedW,
          h: PILL_H,
          r: PILL_H / 2,
          fill: theme.tokens.colors.warn,
          shadow: SOFT_SHADOW,
          tags: `\\fscx70\\fscy70\\t(0,180,\\fscx100\\fscy100)`,
        }),
      );
      lines.push(
        `Dialogue: 2,${formatAssTime(tClose)},${formatAssTime(tResult)},HUD,,0,0,0,,{\\pos(${Math.round(rightEdge - closedW / 2)},${textY})\\an5\\bord0\\shad0\\c${assInlineColor(theme.tokens.colors.ink)}\\fs${assFontSize(LABEL_EM)}\\fsp${LABEL_SPACING}${assFade(150, 0)}}${closedText}`,
      );
    }

    // 4. SOLD / ENDED badge [result.t -> end]
    if (tEnd > tResult) {
      soldText = tl.result.kind === 'sold' ? 'SOLD' : 'ENDED';
      soldFill = tl.result.kind === 'sold' ? theme.tokens.colors.winner : theme.tokens.colors.ink;
      soldW = measureAssTextWidth(soldText, LABEL_EM, 'heavy', 2) + 44;
      lines.push(
        ...buildPanelLines({
          layer: 1,
          t0: tResult,
          t1: tEnd,
          cx: rightEdge - soldW / 2,
          cy: pillCy,
          w: soldW,
          h: PILL_H,
          r: PILL_H / 2,
          fill: soldFill,
          border: tl.result.kind === 'sold' ? null : GLASS_BORDER,
          shadow: SOFT_SHADOW,
          tags: `\\fscx70\\fscy70\\t(0,180,\\fscx100\\fscy100)`,
        }),
      );
      lines.push(
        `Dialogue: 2,${formatAssTime(tResult)},${formatAssTime(tEnd)},HUD,,0,0,0,,{\\pos(${Math.round(rightEdge - soldW / 2)},${textY})\\an5\\bord0\\shad0\\c${assInlineColor('#FFFFFF')}\\fs${assFontSize(LABEL_EM)}\\fsp2${assFade(150, 0)}}${soldText}`,
      );
    }

    return lines;
  } catch (error: any) {
    console.error('[buildHudLines] Error:', error?.response?.data || error?.message || error);
    return [];
  }
};
