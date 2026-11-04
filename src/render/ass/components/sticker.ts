import { ReelTimeline } from '../../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../../interfaces/theme.interface';
import { formatAssTime, assInlineColor } from '../header';
import { assPop, assWobble, assFade } from '../easing';
import { assFontSize } from '../fontSize';
import { assAlpha } from '../alphaTag';
import { measureAssTextWidth } from '../measureAssText';
import { buildPanelLines } from '../panel';

const LINE1_EM = 17;
const LINE2_EM = 28;
const STICKER_H = 108;
const TILT_DEG = -3;
const DEPTH_PX = 7;

// Two-line callout sticker ("NO FIXED PRICE / YOU DECIDE!"): accent card with a hard ink drop,
// tilted, popping in with a wobble. Both lines live in one event so they scale and rotate as a unit.
export const buildStickerLines = (tl: ReelTimeline, theme: ReelThemeVersion): string[] => {
  let lines: string[] = [];
  let stickerConfig: ReelThemeVersion['components']['stickers'];
  let canvasW: number;
  let cx: number;
  let cy: number;
  let cue: ReelTimeline['cues'][number];
  let themeCue: ReelThemeVersion['cue_texts'][string];
  let line1: string;
  let line2: string;
  let w: number;
  let t1: number;
  let animTag: string;
  let durMs: number;
  let ink: string;
  let text: string;

  try {
    stickerConfig = theme.components.stickers;
    if (!stickerConfig || !stickerConfig.enabled) return lines;

    canvasW = theme.canvas?.w || 720;
    cx = canvasW / 2;
    cy = stickerConfig.y + STICKER_H / 2;
    ink = assInlineColor(theme.tokens.colors.ink);

    for (cue of tl.cues || []) {
      themeCue = theme.cue_texts[cue.id];
      if (!themeCue || themeCue.style !== 'sticker') continue;
      t1 = Math.min(cue.t1, tl.end);
      if (t1 - cue.t0 < 0.6) continue;
      durMs = Math.round((t1 - cue.t0) * 1000);
      animTag =
        `\\frz${TILT_DEG}${assPop(60, 100, 0, 240)}${assWobble()}` +
        `\\t(${durMs - 170},${durMs},0.6,\\fscx0\\fscy0)${assFade(120, 0)}`;

      line1 = themeCue.line1 || '';
      line2 = themeCue.line2 || '';
      w =
        Math.max(
          measureAssTextWidth(line1, LINE1_EM, 'heavy', 1.5),
          measureAssTextWidth(line2, LINE2_EM, 'heavy'),
        ) + 60;
      w = Math.min(canvasW - 48, w);

      lines.push(
        ...buildPanelLines({
          layer: 7,
          t0: cue.t0,
          t1,
          cx,
          cy: cy + DEPTH_PX,
          w,
          h: STICKER_H,
          r: 22,
          fill: theme.tokens.colors.ink,
          fillOpacity: 0.6,
          tags: animTag,
        }),
      );
      lines.push(
        ...buildPanelLines({
          layer: 7,
          t0: cue.t0,
          t1,
          cx,
          cy,
          w,
          h: STICKER_H,
          r: 22,
          fill: theme.tokens.colors.accent,
          tags: animTag,
        }),
      );

      text = line1
        ? `{\\fs${assFontSize(LINE1_EM)}\\fsp1.5\\1a${assAlpha(0.72)}}${line1}\\N{\\fs${assFontSize(LINE2_EM)}\\fsp0\\1a&H00&}${line2}`
        : `{\\fs${assFontSize(LINE2_EM)}}${line2}`;
      lines.push(
        `Dialogue: 8,${formatAssTime(cue.t0)},${formatAssTime(t1)},HUD,,0,0,0,,{\\pos(${cx},${cy + 3})\\an5\\q2\\bord0\\shad0\\c${ink}${animTag}}${text}`,
      );
    }

    return lines;
  } catch (error: any) {
    console.error('[buildStickerLines] Error:', error?.response?.data || error?.message || error);
    return [];
  }
};
