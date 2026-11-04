import { ReelTimeline } from '../../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../../interfaces/theme.interface';
import { formatAssTime, assInlineColor } from '../header';
import { buildCirclePath } from '../shapes';
import { assFade } from '../easing';
import { assFontSize } from '../fontSize';
import { assTextCenterY } from '../textCenterY';
import { assAlpha } from '../alphaTag';
import { measureAssTextWidth } from '../measureAssText';
import { splitTemplate } from '../splitTemplate';
import { formatInr } from '../formatInr';
import { buildPanelLines, GLASS_BORDER, SOFT_SHADOW } from '../panel';

const LEAD_S = 0.22; // finale starts slightly before result.t so the slam lands on the beat
const STAMP_CY = 590;
const STAMP_EM = 84;
const PRICE_CY = 702;
const PRICE_H = 70;
const PRICE_LABEL_EM = 22;
const PRICE_AMOUNT_EM = 36;
const WINNER_CY = 790;
const WINNER_H = 64;
const WINNER_LABEL_EM = 16;
const WINNER_NAME_EM = 24;

// SOLD finale: the video dims, a tilted "SOLD!" stamp slams in with a shockwave, then the price pill
// and the purple winner banner rise in underneath. Unsold / cancelled lots get a single warn stamp.
export const buildFinaleLines = (tl: ReelTimeline, theme: ReelThemeVersion): string[] => {
  let lines: string[] = [];
  let finale: ReelThemeVersion['components']['finale'];
  let colors: ReelThemeVersion['tokens']['colors'];
  let canvasW: number;
  let canvasH: number;
  let cx: number;
  let tStart: number;
  let tEnd: number;
  let t0Str: string;
  let tEndStr: string;
  let stampText: string;
  let slamTag: string;
  let tPrice: number;
  let tWinner: number;
  let priceParts: { before: string; value: string; after: string };
  let winnerParts: { before: string; value: string; after: string };
  let priceW: number;
  let winnerW: number;
  let white: string;
  let priceText: string;
  let winnerText: string;
  let waveDelay: number;

  try {
    finale = theme.components.finale;
    if (!finale || !tl.result) return lines;

    tStart = Math.max(0, tl.result.t - LEAD_S);
    tEnd = tl.end;
    if (tEnd <= tStart) return lines;

    colors = theme.tokens.colors;
    canvasW = theme.canvas?.w || 720;
    canvasH = theme.canvas?.h || 1280;
    cx = canvasW / 2;
    t0Str = formatAssTime(tStart);
    tEndStr = formatAssTime(tEnd);
    white = assInlineColor('#FFFFFF');
    slamTag =
      `\\alpha&HFF&\\t(0,60,\\alpha&H00&)\\fscx260\\fscy260` +
      `\\t(0,170,\\fscx92\\fscy92)\\t(170,260,\\fscx100\\fscy100)`;

    // Dim the video only (layer 0 sits under every HUD element) so the finale reads as the climax
    lines.push(
      `Dialogue: 0,${t0Str},${tEndStr},Drawing,,0,0,0,,{\\pos(0,0)\\an7\\p1\\c&H000000&\\1a${assAlpha(0.3)}\\bord0\\shad0${assFade(350, 0)}}m 0 0 l ${canvasW} 0 ${canvasW} ${canvasH} 0 ${canvasH}`,
    );

    if (tl.result.kind !== 'sold') {
      stampText =
        tl.result.kind === 'cancelled'
          ? finale.cancelled || 'AUCTION CANCELLED'
          : finale.unsold || 'UNSOLD';
      lines.push(
        `Dialogue: 14,${t0Str},${tEndStr},Finale,,0,0,0,,{\\pos(${cx},${assTextCenterY(STAMP_CY, 64)})\\an5\\frz-5\\c${assInlineColor(colors.warn)}\\3c${assInlineColor(colors.ink)}\\bord5\\shad6\\4c&H000000&\\4a&H70&\\fs${assFontSize(64)}${slamTag}}${stampText}`,
      );
      return lines;
    }

    // 1. Shockwave rings from the stamp impact
    for (waveDelay of [0.16, 0.3]) {
      lines.push(
        `Dialogue: 12,${formatAssTime(tStart + waveDelay)},${formatAssTime(Math.min(tEnd, tStart + waveDelay + 0.6))},Drawing,,0,0,0,,{\\pos(${cx},${STAMP_CY})\\an5\\p1\\1a&HFF&\\bord5\\3c${assInlineColor(waveDelay < 0.2 ? colors.accent : '#FFFFFF')}\\3a&H30&\\shad0\\blur1\\fscx40\\fscy40\\t(0,600,0.6,\\fscx330\\fscy330\\3a&HFF&)}${buildCirclePath(70, 70, 70)}`,
      );
    }

    // 2. SOLD! stamp slam
    stampText = finale.stamp || 'SOLD!';
    lines.push(
      `Dialogue: 15,${t0Str},${tEndStr},Finale,,0,0,0,,{\\pos(${cx},${assTextCenterY(STAMP_CY, STAMP_EM)})\\an5\\frz-6\\c${assInlineColor(colors.accent)}\\3c${assInlineColor(colors.ink)}\\bord6\\shad7\\4c&H000000&\\4a&H70&\\fs${assFontSize(STAMP_EM)}\\fsp2${slamTag}}${stampText}`,
    );

    // 3. Price pill: "FOR" in soft white, amount in green
    tPrice = tStart + 0.2;
    priceParts = splitTemplate(finale.price, 'amount', formatInr(tl.result.amount));
    priceW =
      measureAssTextWidth(`${priceParts.before}${priceParts.after}`, PRICE_LABEL_EM, 'heavy', 1) +
      measureAssTextWidth(priceParts.value, PRICE_AMOUNT_EM, 'heavy') +
      64;
    priceText =
      `{\\fs${assFontSize(PRICE_LABEL_EM)}\\fsp1\\c${white}\\1a${assAlpha(0.8)}}${priceParts.before}` +
      `{\\fs${assFontSize(PRICE_AMOUNT_EM)}\\fsp0\\c${assInlineColor(colors.bid)}\\1a&H00&}${priceParts.value}` +
      `{\\fs${assFontSize(PRICE_LABEL_EM)}\\fsp1\\c${white}\\1a${assAlpha(0.8)}}${priceParts.after}`;
    lines.push(
      ...buildPanelLines({
        layer: 13,
        t0: tPrice,
        t1: tEnd,
        cx,
        cy: PRICE_CY,
        w: priceW,
        h: PRICE_H,
        r: PRICE_H / 2,
        fill: colors.glass,
        fillOpacity: 0.86,
        border: GLASS_BORDER,
        shadow: SOFT_SHADOW,
        tags: assFade(220, 0),
        from: { dx: 0, dy: 24, ms: 300 },
      }),
    );
    lines.push(
      `Dialogue: 14,${formatAssTime(tPrice)},${tEndStr},HUD,,0,0,0,,{\\move(${cx},${assTextCenterY(PRICE_CY, PRICE_AMOUNT_EM) + 24},${cx},${assTextCenterY(PRICE_CY, PRICE_AMOUNT_EM)},0,300)\\an5\\bord0\\shad0${assFade(220, 0)}}${priceText}`,
    );

    // 4. Winner banner with a purple glow
    tWinner = tStart + 0.38;
    winnerParts = splitTemplate(finale.winner, 'winner', tl.result.winner);
    winnerW =
      measureAssTextWidth(
        `${winnerParts.before}${winnerParts.after}`,
        WINNER_LABEL_EM,
        'heavy',
        1.5,
      ) +
      measureAssTextWidth(winnerParts.value, WINNER_NAME_EM, 'heavy') +
      64;
    winnerW = Math.min(canvasW - 48, winnerW);
    winnerText =
      `{\\fs${assFontSize(WINNER_LABEL_EM)}\\fsp1.5\\1a${assAlpha(0.85)}}${winnerParts.before}` +
      `{\\fs${assFontSize(WINNER_NAME_EM)}\\fsp0\\1a&H00&}${winnerParts.value}` +
      `{\\fs${assFontSize(WINNER_LABEL_EM)}\\fsp1.5\\1a${assAlpha(0.85)}}${winnerParts.after}`;
    lines.push(
      ...buildPanelLines({
        layer: 13,
        t0: tWinner,
        t1: tEnd,
        cx,
        cy: WINNER_CY,
        w: winnerW + 24,
        h: WINNER_H + 24,
        r: (WINNER_H + 24) / 2,
        fill: colors.winner,
        fillOpacity: 0.45,
        tags: `\\blur16${assFade(300, 0)}`,
      }),
    );
    lines.push(
      ...buildPanelLines({
        layer: 13,
        t0: tWinner,
        t1: tEnd,
        cx,
        cy: WINNER_CY,
        w: winnerW,
        h: WINNER_H,
        r: WINNER_H / 2,
        fill: colors.winner,
        shadow: SOFT_SHADOW,
        tags: `\\fscx70\\fscy70\\t(0,200,\\fscx104\\fscy104)\\t(200,280,\\fscx100\\fscy100)${assFade(150, 0)}`,
      }),
    );
    lines.push(
      `Dialogue: 14,${formatAssTime(tWinner)},${tEndStr},HUD,,0,0,0,,{\\pos(${cx},${assTextCenterY(WINNER_CY, WINNER_NAME_EM)})\\an5\\bord0\\shad0\\c${white}\\fscx70\\fscy70\\t(0,200,\\fscx104\\fscy104)\\t(200,280,\\fscx100\\fscy100)${assFade(150, 0)}}${winnerText}`,
    );

    return lines;
  } catch (error: any) {
    console.error('[buildFinaleLines] Error:', error?.response?.data || error?.message || error);
    return [];
  }
};
