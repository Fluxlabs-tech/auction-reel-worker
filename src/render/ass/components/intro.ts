import { ReelTimeline } from '../../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../../interfaces/theme.interface';
import { formatAssTime, assInlineColor } from '../header';
import { buildRoundedRectPath } from '../shapes';
import { assMove, assFade } from '../easing';
import { assFontSize } from '../fontSize';
import { assTextCenterY } from '../textCenterY';
import { assAlpha } from '../alphaTag';
import { measureAssTextWidth } from '../measureAssText';
import { splitTemplate } from '../splitTemplate';
import { buildPanelLines, GLASS_BORDER, SOFT_SHADOW } from '../panel';

const TITLE_EM = 34;
const SUB_EM = 21;
const CARD_H = 146;
const SLIDE_PX = 26;
const SLIDE_MS = 350;

// Lot reveal card: "#20 ITEM UP!" with the opening price highlighted, dropping in under the HUD so
// it never covers the host's face. Width follows the copy.
export const buildIntroLines = (tl: ReelTimeline, theme: ReelThemeVersion): string[] => {
  let lines: string[] = [];
  let intro: ReelThemeVersion['components']['intro'];
  let canvasW: number;
  let cx: number;
  let top: number;
  let t0: number;
  let t1: number;
  let ordinal: string;
  let priceText: string;
  let titleParts: { before: string; value: string; after: string };
  let subParts: { before: string; value: string; after: string };
  let titleW: number;
  let subW: number;
  let cardW: number;
  let titleY: number;
  let barY: number;
  let subY: number;
  let fadeTag: string;
  let white: string;
  let accent: string;
  let green: string;
  let titleText: string;
  let subText: string;

  try {
    intro = theme.components.intro;
    if (!intro || !intro.enabled) return lines;
    if (tl.intro.t1 <= tl.intro.t0) return lines;

    canvasW = theme.canvas?.w || 720;
    cx = canvasW / 2;
    top = intro.y;
    t0 = tl.intro.t0;
    t1 = tl.intro.t1;
    white = assInlineColor('#FFFFFF');
    accent = assInlineColor(theme.tokens.colors.accent);
    green = assInlineColor(theme.tokens.colors.bid);
    fadeTag = assFade(250, 250);

    ordinal = `#${tl.meta.lot_no}`;
    priceText = `₹${tl.meta.starting_price.toLocaleString('en-IN')}`;
    titleParts = splitTemplate(intro.title, 'lot_ordinal', ordinal);
    subParts = splitTemplate(intro.subtitle, 'starting_price', priceText);

    titleW = measureAssTextWidth(
      `${titleParts.before}${titleParts.value}${titleParts.after}`,
      TITLE_EM,
      'heavy',
    );
    subW =
      measureAssTextWidth(`${subParts.before}${subParts.after}`, SUB_EM, 'bold') +
      measureAssTextWidth(subParts.value, SUB_EM, 'heavy');
    cardW = Math.min(canvasW - 56, Math.max(380, Math.max(titleW, subW) + 80));

    titleY = top + 50;
    barY = top + 86;
    subY = top + 112;

    // Lot number in white, rest of the headline in accent yellow
    titleText =
      `{\\c${accent}}${titleParts.before}{\\c${white}}${titleParts.value}` +
      `{\\c${accent}}${titleParts.after}`;
    // Copy in soft white Bold, price in green ExtraBold
    subText =
      `{\\fnPoppins\\b1\\c${white}\\1a${assAlpha(0.82)}}${subParts.before}` +
      `{\\fnPoppins ExtraBold\\c${green}\\1a&H00&}${subParts.value}` +
      `{\\fnPoppins\\b1\\c${white}\\1a${assAlpha(0.82)}}${subParts.after}`;

    lines.push(
      ...buildPanelLines({
        layer: 1,
        t0,
        t1,
        cx,
        cy: top + CARD_H / 2,
        w: cardW,
        h: CARD_H,
        r: 26,
        fill: theme.tokens.colors.glass,
        border: GLASS_BORDER,
        shadow: SOFT_SHADOW,
        tags: fadeTag,
        from: { dx: 0, dy: -SLIDE_PX, ms: SLIDE_MS },
      }),
    );

    // Accent divider between headline and price
    lines.push(
      `Dialogue: 2,${formatAssTime(t0)},${formatAssTime(t1)},Drawing,,0,0,0,,{\\an5${assMove(cx, barY - SLIDE_PX, cx, barY, 0, SLIDE_MS)}\\p1\\c${accent}\\bord0\\shad0${fadeTag}}${buildRoundedRectPath(44, 5, 2.5, 0, 0)}`,
    );
    lines.push(
      `Dialogue: 2,${formatAssTime(t0)},${formatAssTime(t1)},Default,,0,0,0,,{${assMove(cx, assTextCenterY(titleY, TITLE_EM) - SLIDE_PX, cx, assTextCenterY(titleY, TITLE_EM), 0, SLIDE_MS)}\\an5\\bord0\\shad0\\fs${assFontSize(TITLE_EM)}${fadeTag}}${titleText}`,
    );
    lines.push(
      `Dialogue: 2,${formatAssTime(t0)},${formatAssTime(t1)},Default,,0,0,0,,{${assMove(cx, assTextCenterY(subY, SUB_EM) - SLIDE_PX, cx, assTextCenterY(subY, SUB_EM), 0, SLIDE_MS)}\\an5\\bord0\\shad0\\fs${assFontSize(SUB_EM)}${fadeTag}}${subText}`,
    );

    return lines;
  } catch (error: any) {
    console.error('[buildIntroLines] Error:', error?.response?.data || error?.message || error);
    return [];
  }
};
