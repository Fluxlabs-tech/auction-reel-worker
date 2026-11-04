import { ReelTimeline } from '../../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../../interfaces/theme.interface';
import { formatAssTime, assInlineColor } from '../header';
import { buildRoundedRectPath, buildCirclePath } from '../shapes';
import { assPop, assMove } from '../easing';
import { assFontSize } from '../fontSize';
import { assTextCenterY } from '../textCenterY';
import { assAlpha } from '../alphaTag';
import { measureAssTextWidth } from '../measureAssText';
import { formatInr } from '../formatInr';
import { buildPanelLines, GLASS_BORDER, SOFT_SHADOW } from '../panel';

type BidPhase = 'start' | 'current' | 'final';

interface BidInterval {
  t0: number;
  t1: number;
  amount: number;
  delta: number;
  bidder: string;
  phase: BidPhase;
  isNewBid: boolean;
}

const PAD = 22;
const LABEL_EM = 15;
const AMOUNT_EM = 46;
const DELTA_EM = 19;
const NAME_EM = 18;
const AVATAR_R = 14;
const MAX_NAME_CHARS = 16;
const FINALE_LEAD_S = 0.22;
const HIDE_FADE_MS = 300;

// Live bid card: phase label, the current amount (pops + "+₹delta" on every new bid), and the
// bidder with a coloured initial avatar. New bids flash the card border — the fill is never touched,
// so the amount is always readable. Fades out when the SOLD finale takes over.
export const buildBidCardLines = (tl: ReelTimeline, theme: ReelThemeVersion): string[] => {
  let lines: string[] = [];
  let card: ReelThemeVersion['components']['bid_card'];
  let colors: ReelThemeVersion['tokens']['colors'];
  let tLive: number;
  let tClose: number;
  let tCardEnd: number;
  let hidesAtFinale: boolean;
  let bids: ReelTimeline['bids'];
  let intervals: BidInterval[] = [];
  let split: BidInterval[] = [];
  let i: number;
  let bid: ReelTimeline['bids'][number];
  let nextT: number;
  let prevAmount: number;
  let iv: BidInterval;
  let cardW: number;
  let contentW: number;
  let maxCardW: number;
  let cardCx: number;
  let cardCy: number;
  let x0: number;
  let labelCy: number;
  let amountCy: number;
  let bidderCy: number;
  let t0Str: string;
  let t1Str: string;
  let label: string;
  let labelColor: string;
  let dotColor: string;
  let amountStr: string;
  let amountW: number;
  let inTag: string;
  let outTag: string;
  let fadeTag: string;
  let name: string;
  let avatarPalette: string[];
  let avatarColor: string;
  let hash: number;
  let k: number;
  let ringLeft: number;

  try {
    card = theme.components.bid_card;
    if (!card || !card.enabled) return lines;

    colors = theme.tokens.colors;
    tLive = tl.live.t;
    tClose = tl.close.t;
    hidesAtFinale = tl.result.kind === 'sold';
    tCardEnd = hidesAtFinale
      ? Math.min(tl.end, Math.max(tLive + 0.5, tl.result.t - FINALE_LEAD_S + HIDE_FADE_MS / 1000))
      : tl.end;
    if (tCardEnd <= tLive) return lines;

    // 1. Build price intervals: starting price, then one per bid
    bids = (tl.bids || []).filter((b) => b.t < tCardEnd);
    prevAmount = tl.meta.starting_price;
    if (bids.length === 0 || bids[0].t > tLive) {
      intervals.push({
        t0: tLive,
        t1: bids.length > 0 ? bids[0].t : tCardEnd,
        amount: tl.meta.starting_price,
        delta: 0,
        bidder: '',
        phase: 'start',
        isNewBid: false,
      });
    }
    for (i = 0; i < bids.length; i++) {
      bid = bids[i];
      nextT = i + 1 < bids.length ? bids[i + 1].t : tCardEnd;
      intervals.push({
        t0: Math.max(tLive, bid.t),
        t1: Math.min(tCardEnd, nextT),
        amount: bid.amount,
        delta: bid.amount - prevAmount,
        bidder: bid.bidder,
        phase: 'current',
        isNewBid: true,
      });
      prevAmount = bid.amount;
    }

    // 2. Once bidding closes the standing bid becomes the FINAL BID
    for (iv of intervals) {
      if (iv.t1 <= iv.t0) continue;
      if (iv.t0 < tClose && iv.t1 > tClose) {
        split.push({ ...iv, t1: tClose });
        split.push({ ...iv, t0: tClose, phase: 'final', isNewBid: false, delta: 0 });
      } else {
        split.push(iv.t0 >= tClose ? { ...iv, phase: 'final' } : iv);
      }
    }
    intervals = split;
    if (intervals.length === 0) return lines;

    // 3. Size the card once for the widest amount / bidder so it never jitters between bids
    contentW = 0;
    for (iv of intervals) {
      amountW = measureAssTextWidth(formatInr(iv.amount), AMOUNT_EM, 'heavy');
      if (iv.delta > 0) {
        amountW += 12 + measureAssTextWidth(`+${formatInr(iv.delta)}`, DELTA_EM, 'heavy');
      }
      contentW = Math.max(contentW, amountW);
      if (card.show_bidder && iv.bidder) {
        contentW = Math.max(
          contentW,
          AVATAR_R * 2 +
            10 +
            measureAssTextWidth(iv.bidder.slice(0, MAX_NAME_CHARS), NAME_EM, 'bold'),
        );
      }
    }
    ringLeft = theme.components.ring?.enabled
      ? theme.components.ring.cx - theme.components.ring.r
      : (theme.canvas?.w || 720) - 28;
    maxCardW = Math.max(card.w, ringLeft - 16 - card.x);
    cardW = Math.round(Math.min(maxCardW, Math.max(card.w, contentW + PAD * 2)));

    x0 = card.x;
    cardCx = x0 + cardW / 2;
    cardCy = card.y + card.h / 2;
    labelCy = card.y + 30;
    amountCy = card.y + 77;
    bidderCy = card.y + card.h - 30;
    avatarPalette = [
      colors.key,
      colors.winner,
      colors.live,
      colors.accent,
      colors.bid,
      colors.warn,
    ];

    // 4. Glass card body
    lines.push(
      ...buildPanelLines({
        layer: 1,
        t0: tLive,
        t1: tCardEnd,
        cx: cardCx,
        cy: cardCy,
        w: cardW,
        h: card.h,
        r: 24,
        fill: colors.glass,
        border: GLASS_BORDER,
        shadow: SOFT_SHADOW,
        tags: `\\fscx92\\fscy92\\t(0,220,\\fscx100\\fscy100)\\fad(200,${hidesAtFinale ? HIDE_FADE_MS : 0})`,
      }),
    );

    // 5. Per-interval content
    for (i = 0; i < intervals.length; i++) {
      iv = intervals[i];
      t0Str = formatAssTime(iv.t0);
      t1Str = formatAssTime(iv.t1);
      inTag = i === 0 ? '\\fad(200,0)' : '';
      outTag = hidesAtFinale && iv.t1 >= tCardEnd - 0.001 ? `\\fad(0,${HIDE_FADE_MS})` : '';
      fadeTag = inTag && outTag ? `\\fad(200,${HIDE_FADE_MS})` : inTag || outTag;

      if (iv.phase === 'start') {
        label = 'STARTING BID';
        labelColor = '#FFFFFF';
        dotColor = '#FFFFFF';
      } else if (iv.phase === 'final') {
        label = 'FINAL BID';
        labelColor = colors.warn;
        dotColor = colors.warn;
      } else {
        label = 'CURRENT BID';
        labelColor = colors.accent;
        dotColor = colors.bid;
      }

      // Phase label with status dot
      lines.push(
        `Dialogue: 2,${t0Str},${t1Str},Drawing,,0,0,0,,{\\pos(${x0 + PAD + 5},${labelCy})\\an5\\p1\\c${assInlineColor(dotColor)}\\bord0\\shad0${fadeTag}}${buildCirclePath(5, 5, 5)}`,
      );
      lines.push(
        `Dialogue: 3,${t0Str},${t1Str},HUD,,0,0,0,,{\\pos(${x0 + PAD + 18},${assTextCenterY(labelCy, LABEL_EM)})\\an4\\bord0\\shad0\\c${assInlineColor(labelColor)}${iv.phase === 'start' ? `\\1a${assAlpha(0.7)}` : ''}\\fs${assFontSize(LABEL_EM)}\\fsp2${fadeTag}}${label}`,
      );

      // Amount (pops on a new bid)
      amountStr = formatInr(iv.amount);
      lines.push(
        `Dialogue: 3,${t0Str},${t1Str},BidCard,,0,0,0,,{\\pos(${x0 + PAD},${assTextCenterY(amountCy, AMOUNT_EM)})\\an4\\bord0\\shad0\\c${assInlineColor('#FFFFFF')}\\fs${assFontSize(AMOUNT_EM)}${iv.isNewBid ? assPop(122, 100, 0, 220) : ''}${fadeTag}}${amountStr}`,
      );

      // "+₹delta" floats up beside the amount
      if (iv.isNewBid && iv.delta > 0) {
        amountW = measureAssTextWidth(amountStr, AMOUNT_EM, 'heavy');
        lines.push(
          `Dialogue: 3,${t0Str},${formatAssTime(Math.min(iv.t1, iv.t0 + 1.1))},HUD,,0,0,0,,{${assMove(x0 + PAD + amountW + 12, assTextCenterY(amountCy, DELTA_EM) + 4, x0 + PAD + amountW + 12, assTextCenterY(amountCy, DELTA_EM) - 16, 0, 1000)}\\an4\\bord0\\shad0\\c${assInlineColor(colors.bid)}\\fs${assFontSize(DELTA_EM)}\\fad(80,380)}+${formatInr(iv.delta)}`,
        );
      }

      // Bidder row: initial avatar + handle, or a nudge while nobody has bid yet
      if (card.show_bidder && iv.bidder) {
        name =
          iv.bidder.length > MAX_NAME_CHARS
            ? `${iv.bidder.slice(0, MAX_NAME_CHARS - 1)}…`
            : iv.bidder;
        for (hash = 0, k = 0; k < iv.bidder.length; k++) {
          hash = (hash * 31 + iv.bidder.charCodeAt(k)) >>> 0;
        }
        avatarColor = avatarPalette[hash % avatarPalette.length];
        lines.push(
          `Dialogue: 2,${t0Str},${t1Str},Drawing,,0,0,0,,{\\pos(${x0 + PAD + AVATAR_R},${bidderCy})\\an5\\p1\\c${assInlineColor(avatarColor)}\\bord0\\shad0${fadeTag}}${buildCirclePath(AVATAR_R, AVATAR_R, AVATAR_R)}`,
        );
        lines.push(
          `Dialogue: 3,${t0Str},${t1Str},HUD,,0,0,0,,{\\pos(${x0 + PAD + AVATAR_R},${assTextCenterY(bidderCy, 15)})\\an5\\bord0\\shad0\\c${assInlineColor(colors.ink)}\\fs${assFontSize(15)}${fadeTag}}${name.charAt(0).toUpperCase()}`,
        );
        lines.push(
          `Dialogue: 3,${t0Str},${t1Str},HUD,,0,0,0,,{\\pos(${x0 + PAD + AVATAR_R * 2 + 10},${assTextCenterY(bidderCy, NAME_EM)})\\an4\\bord0\\shad0\\fnPoppins\\b1\\c${assInlineColor('#FFFFFF')}\\1a${assAlpha(0.88)}\\fs${assFontSize(NAME_EM)}${fadeTag}}${name}`,
        );
      } else if (card.show_bidder && iv.phase === 'start') {
        lines.push(
          `Dialogue: 3,${t0Str},${t1Str},HUD,,0,0,0,,{\\pos(${x0 + PAD},${assTextCenterY(bidderCy, NAME_EM)})\\an4\\bord0\\shad0\\fnPoppins\\b1\\c${assInlineColor('#FFFFFF')}\\1a${assAlpha(0.6)}\\fs${assFontSize(NAME_EM)}${fadeTag}}Be the first to bid!`,
        );
      }

      // Border-only flash on new bid (transparent fill so the content stays visible)
      if (iv.isNewBid) {
        lines.push(
          `Dialogue: 4,${t0Str},${formatAssTime(Math.min(iv.t1, iv.t0 + 0.7))},Drawing,,0,0,0,,{\\pos(${Math.round(cardCx)},${Math.round(cardCy)})\\an5\\p1\\1a&HFF&\\bord3\\3c${assInlineColor(colors.bid)}\\3a&H00&\\shad0\\blur2\\t(0,700,\\3a&HFF&)}${buildRoundedRectPath(cardW, card.h, 24, 0, 0)}`,
        );
      }
    }

    return lines;
  } catch (error: any) {
    console.error('[buildBidCardLines] Error:', error?.response?.data || error?.message || error);
    return [];
  }
};
