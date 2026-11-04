import { ReelTimeline } from '../../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../../interfaces/theme.interface';
import { formatAssTime, assInlineColor } from '../header';
import { buildCirclePath } from '../shapes';
import { assMove, assFade } from '../easing';
import { assFontSize } from '../fontSize';
import { assTextCenterY } from '../textCenterY';
import { measureAssTextWidth } from '../measureAssText';
import { formatInr } from '../formatInr';
import { buildPanelLines, GLASS_BORDER, SOFT_SHADOW } from '../panel';

const CHIP_H = 52;
const TEXT_EM = 18;
const ICON_R = 15;
const SLIDE_PX = 40;
const SLIDE_MS = 320;
// Check mark drawn in a 16x16 box, centred via \an5
const CHECK_PATH = 'm 1 8 l 4 5 l 7 8 l 13 1 l 16 4 l 7 14';

// Value cue chips (COD, free shipping, genuine…): glass pill with an icon badge, sliding in from the
// left under the bid card. Width follows the copy.
export const buildCueChipLines = (tl: ReelTimeline, theme: ReelThemeVersion): string[] => {
  let lines: string[] = [];
  let chipsConfig: ReelThemeVersion['components']['chips'];
  let cues: ReelTimeline['cues'];
  let i: number;
  let shown: number;
  let cue: ReelTimeline['cues'][number];
  let themeCue: ReelThemeVersion['cue_texts'][string];
  let text: string;
  let top: number;
  let cy: number;
  let x: number;
  let w: number;
  let t0: number;
  let t1: number;
  let t0Str: string;
  let t1Str: string;
  let iconCx: number;
  let textX: number;
  let iconGlyph: string;

  try {
    chipsConfig = theme.components.chips;
    if (!chipsConfig || !chipsConfig.enabled || !chipsConfig.y || chipsConfig.y.length === 0) {
      return lines;
    }

    cues = tl.cues || [];
    x = chipsConfig.x;
    shown = 0;

    for (i = 0; i < cues.length; i++) {
      cue = cues[i];
      themeCue = theme.cue_texts[cue.id];
      if (!themeCue || themeCue.style === 'sticker') continue;

      text = themeCue.text || cue.id;
      if (cue.amount && text.includes('{amount}')) {
        text = text.replace('{amount}', formatInr(cue.amount));
      }

      t0 = cue.t0;
      t1 = Math.min(cue.t1, tl.end);
      if (t1 <= t0) continue;
      t0Str = formatAssTime(t0);
      t1Str = formatAssTime(t1);

      top = chipsConfig.y[shown % chipsConfig.y.length];
      shown++;
      cy = top + CHIP_H / 2;
      w = 14 + ICON_R * 2 + 12 + measureAssTextWidth(text, TEXT_EM, 'bold') + 22;
      iconCx = x + 14 + ICON_R;
      textX = x + 14 + ICON_R * 2 + 12;
      iconGlyph = themeCue.icon === 'cash' ? '₹' : '';

      lines.push(
        ...buildPanelLines({
          layer: 5,
          t0,
          t1,
          cx: x + w / 2,
          cy,
          w,
          h: CHIP_H,
          r: CHIP_H / 2,
          fill: theme.tokens.colors.glass,
          border: GLASS_BORDER,
          shadow: SOFT_SHADOW,
          tags: assFade(200, 220),
          from: { dx: -SLIDE_PX, dy: 0, ms: SLIDE_MS },
        }),
      );
      lines.push(
        `Dialogue: 6,${t0Str},${t1Str},Drawing,,0,0,0,,{\\an5${assMove(iconCx - SLIDE_PX, cy, iconCx, cy, 0, SLIDE_MS)}\\p1\\c${assInlineColor(theme.tokens.colors.key)}\\bord0\\shad0${assFade(200, 220)}}${buildCirclePath(ICON_R, ICON_R, ICON_R)}`,
      );
      if (iconGlyph) {
        lines.push(
          `Dialogue: 7,${t0Str},${t1Str},HUD,,0,0,0,,{\\an5${assMove(iconCx - SLIDE_PX, assTextCenterY(cy, 17), iconCx, assTextCenterY(cy, 17), 0, SLIDE_MS)}\\bord0\\shad0\\c${assInlineColor(theme.tokens.colors.ink)}\\fs${assFontSize(17)}${assFade(200, 220)}}${iconGlyph}`,
        );
      } else {
        lines.push(
          `Dialogue: 7,${t0Str},${t1Str},Drawing,,0,0,0,,{\\an5${assMove(iconCx - SLIDE_PX, cy, iconCx, cy, 0, SLIDE_MS)}\\p1\\c${assInlineColor(theme.tokens.colors.ink)}\\bord0\\shad0${assFade(200, 220)}}${CHECK_PATH}`,
        );
      }
      lines.push(
        `Dialogue: 7,${t0Str},${t1Str},HUD,,0,0,0,,{${assMove(textX - SLIDE_PX, assTextCenterY(cy, TEXT_EM), textX, assTextCenterY(cy, TEXT_EM), 0, SLIDE_MS)}\\an4\\bord0\\shad0\\fnPoppins\\b1\\c${assInlineColor('#FFFFFF')}\\fs${assFontSize(TEXT_EM)}${assFade(200, 220)}}${text}`,
      );
    }

    return lines;
  } catch (error: any) {
    console.error('[buildCueChipLines] Error:', error?.response?.data || error?.message || error);
    return [];
  }
};
