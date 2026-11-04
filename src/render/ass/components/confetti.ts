import { ReelTimeline } from '../../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../../interfaces/theme.interface';
import { formatAssTime, assInlineColor } from '../header';
import { buildRoundedRectPath, buildCirclePath } from '../shapes';
import { createSeededRandom } from '../seededRandom';

const PIECES = 46;
const LEAD_S = 0.22;
const IMPACT_S = 0.16;

// Pure-ASS confetti rain for SOLD finales (no alpha-video asset needed): tumbling strips and dots in
// the theme palette, deterministic per auction so re-renders match. Sits under the finale panels.
export const buildConfettiLines = (tl: ReelTimeline, theme: ReelThemeVersion): string[] => {
  let lines: string[] = [];
  let colors: ReelThemeVersion['tokens']['colors'];
  let palette: string[];
  let rand: () => number;
  let canvasW: number;
  let canvasH: number;
  let tImpact: number;
  let i: number;
  let x0: number;
  let y0: number;
  let x1: number;
  let delay: number;
  let fall: number;
  let t0: number;
  let t1: number;
  let rot0: number;
  let rot1: number;
  let flip: number;
  let path: string;
  let pieceW: number;
  let pieceH: number;

  try {
    if (!tl.result || tl.result.kind !== 'sold') return lines;

    colors = theme.tokens.colors;
    palette = [colors.accent, colors.live, colors.bid, colors.key, colors.winner, '#FFFFFF'];
    rand = createSeededRandom(`${tl.meta.auction_id}:${tl.meta.lot_no}`);
    canvasW = theme.canvas?.w || 720;
    canvasH = theme.canvas?.h || 1280;
    tImpact = Math.max(0, tl.result.t - LEAD_S) + IMPACT_S;
    if (tImpact >= tl.end) return lines;

    for (i = 0; i < PIECES; i++) {
      x0 = Math.round(rand() * canvasW);
      y0 = Math.round(-30 - rand() * 260);
      x1 = Math.round(x0 + (rand() - 0.5) * 220);
      delay = rand() * 0.7;
      fall = 2.6 + rand() * 1.8;
      t0 = tImpact + delay;
      t1 = Math.min(tl.end, t0 + fall);
      if (t1 <= t0) continue;

      rot0 = Math.round(rand() * 360);
      rot1 = Math.round(rot0 + (rand() - 0.5) * 1100);
      flip = Math.round(360 + rand() * 720);
      if (rand() < 0.7) {
        pieceW = Math.round(8 + rand() * 6);
        pieceH = Math.round(14 + rand() * 10);
        path = buildRoundedRectPath(pieceW, pieceH, 2, 0, 0);
      } else {
        pieceW = Math.round(5 + rand() * 3);
        path = buildCirclePath(pieceW, pieceW, pieceW);
      }

      lines.push(
        `Dialogue: 11,${formatAssTime(t0)},${formatAssTime(t1)},Drawing,,0,0,0,,{\\an5\\move(${x0},${y0},${x1},${canvasH + 60})\\p1\\c${assInlineColor(palette[i % palette.length])}\\bord0\\shad0\\frz${rot0}\\t(\\frz${rot1}\\fry${flip})}${path}`,
      );
    }

    return lines;
  } catch (error: any) {
    console.error('[buildConfettiLines] Error:', error?.response?.data || error?.message || error);
    return [];
  }
};
