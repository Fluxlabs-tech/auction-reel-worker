import { ReelTimeline, TimelineDeadlineSegment } from '../../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../../interfaces/theme.interface';
import { formatAssTime, assInlineColor } from '../header';
import { buildCirclePath, buildArcPath } from '../shapes';
import { assPop, assFade } from '../easing';
import { assFontSize } from '../fontSize';
import { assTextCenterY } from '../textCenterY';
import { assAlpha } from '../alphaTag';
import { measureAssTextWidth } from '../measureAssText';
import { buildPanelLines, GLASS_BORDER, SOFT_SHADOW } from '../panel';

const STROKE = 7;
const TRACK_INSET = 13;
const SLICE_S = 1 / 15; // arc redraw cadence: every other frame at 30fps
const REFILL_S = 0.3; // arc sweeps back to full over this long when a bid resets the timer
const DIGIT_EM = 34;
const UNIT_EM = 17;
const CHIP_EM = 13;
const CHIP_H = 30;
const CHIP_SHOW_S = 1.4;
const CHIP_THROTTLE_S = 5; // rapid-fire bids would otherwise strobe the chip
const ZERO_HOLD_S = 0.8;
const EPS = 1e-6;

// Countdown ring (top-right): glass disc, faint track, a depleting progress arc with round caps that
// turns amber at 5s and red at 3s, and the seconds digit. Each deadline segment only runs until the
// next reset — previously every segment ran to its own deadline, stacking two arcs and two digits.
export const buildCountdownRingLines = (tl: ReelTimeline, theme: ReelThemeVersion): string[] => {
  let lines: string[] = [];
  let ring: ReelThemeVersion['components']['ring'];
  let colors: ReelThemeVersion['tokens']['colors'];
  let segments: TimelineDeadlineSegment[];
  let ringStart: number;
  let ringEnd: number;
  let ringHide: number;
  let trackR: number;
  let idx: number;
  let seg: TimelineDeadlineSegment;
  let prevSeg: TimelineDeadlineSegment;
  let segStart: number;
  let segEnd: number;
  let duration: number;
  let prevFraction: number;
  let sliceT0: number;
  let sliceT1: number;
  let timeLeft: number;
  let fraction: number;
  let k: number;
  let arcColor: string;
  let endAngle: number;
  let startAngle: number;
  let capR: number;
  let capPath: string;
  let digitT0: number;
  let digitT1: number;
  let digit: number;
  let digitColor: string;
  let popTag: string;
  let isFirstDigit: boolean;
  let lastChipT0: number;
  let chipText: string;
  let chipW: number;
  let chipCy: number;
  let digitY: number;
  let digitFs: number;
  let unitFs: number;

  try {
    ring = theme.components.ring;
    if (!ring || !ring.enabled) return lines;
    if (!tl.deadline || !tl.deadline.segments || tl.deadline.segments.length === 0) return lines;

    colors = theme.tokens.colors;
    segments = [...tl.deadline.segments].sort((a, b) => a.t - b.t);
    ringStart = Math.max(segments[0].t, tl.live?.t ?? segments[0].t);
    ringEnd = tl.close?.t !== undefined ? tl.close.t : tl.end;
    if (ringEnd <= ringStart) return lines;
    ringHide = Math.min(tl.end, ringEnd + ZERO_HOLD_S);

    trackR = ring.r - TRACK_INSET;
    capR = STROKE / 2;
    startAngle = -Math.PI / 2;
    digitY = assTextCenterY(ring.cy, DIGIT_EM);
    chipCy = ring.cy + ring.r + 8 + CHIP_H / 2;
    lastChipT0 = -Infinity;
    digitFs = assFontSize(DIGIT_EM);
    unitFs = assFontSize(UNIT_EM);

    // 1. Disc + faint track for the whole bidding window (pops in, fades out after close)
    lines.push(
      ...buildPanelLines({
        layer: 1,
        t0: ringStart,
        t1: ringHide,
        cx: ring.cx,
        cy: ring.cy,
        w: ring.r * 2,
        h: ring.r * 2,
        r: ring.r,
        fill: colors.glass,
        border: GLASS_BORDER,
        shadow: SOFT_SHADOW,
        tags: `\\fscx60\\fscy60\\t(0,240,\\fscx100\\fscy100)${assFade(150, 300)}`,
      }),
    );
    lines.push(
      `Dialogue: 2,${formatAssTime(ringStart)},${formatAssTime(ringHide)},Drawing,,0,0,0,,{\\pos(0,0)\\an7\\p1\\c${assInlineColor('#FFFFFF')}\\1a${assAlpha(0.16)}\\bord0\\shad0${assFade(150, 300)}}${buildArcPath(ring.cx, ring.cy, trackR, 0, 2 * Math.PI, STROKE)}`,
    );

    for (idx = 0; idx < segments.length; idx++) {
      seg = segments[idx];
      segStart = Math.max(seg.t, ringStart);
      // Run until the next reset (or close). Past its own deadline the segment simply holds at 0s,
      // which covers close events that land a little after the computed deadline.
      segEnd = Math.min(ringEnd, idx + 1 < segments.length ? segments[idx + 1].t : ringEnd);
      if (segEnd <= segStart + EPS) continue;

      duration = Math.max(1, seg.ends - seg.t);
      if (idx === 0) {
        prevFraction = 0; // first fill sweeps in from empty
      } else {
        prevSeg = segments[idx - 1];
        prevFraction = Math.max(
          0,
          Math.min(1, (prevSeg.ends - segStart) / Math.max(1, prevSeg.ends - prevSeg.t)),
        );
      }

      // 2. Progress arc + round caps, redrawn every SLICE_S
      for (sliceT0 = segStart; sliceT0 < segEnd - EPS; sliceT0 += SLICE_S) {
        sliceT1 = Math.min(segEnd, sliceT0 + SLICE_S);
        timeLeft = seg.ends - sliceT0;
        fraction = Math.max(0, Math.min(1, timeLeft / duration));
        k = (sliceT0 - segStart) / REFILL_S;
        if (k < 1) {
          fraction = prevFraction + (fraction - prevFraction) * (1 - Math.pow(1 - k, 3));
        }
        if (fraction < 0.004) continue;

        arcColor = timeLeft <= 3 ? colors.live : timeLeft <= 5 ? colors.warn : colors.bid;
        endAngle = startAngle + fraction * 2 * Math.PI;
        capPath = [
          buildCirclePath(
            ring.cx + Math.cos(startAngle) * trackR,
            ring.cy + Math.sin(startAngle) * trackR,
            capR,
          ),
          buildCirclePath(
            ring.cx + Math.cos(endAngle) * trackR,
            ring.cy + Math.sin(endAngle) * trackR,
            capR,
          ),
        ].join(' ');

        lines.push(
          `Dialogue: 3,${formatAssTime(sliceT0)},${formatAssTime(sliceT1)},Drawing,,0,0,0,,{\\pos(0,0)\\an7\\p1\\c${assInlineColor(arcColor)}\\bord0\\shad0}${buildArcPath(ring.cx, ring.cy, trackR, startAngle, endAngle, STROKE)}`,
        );
        lines.push(
          `Dialogue: 3,${formatAssTime(sliceT0)},${formatAssTime(sliceT1)},Drawing,,0,0,0,,{\\pos(0,0)\\an7\\p1\\c${assInlineColor(arcColor)}\\bord0\\shad0}${capPath}`,
        );
      }

      // 3. Seconds digit, switching exactly on whole seconds before the deadline
      isFirstDigit = true;
      for (digitT0 = segStart; digitT0 < segEnd - EPS; digitT0 = digitT1) {
        digit = Math.max(0, Math.ceil(seg.ends - digitT0 - EPS));
        digitT1 = digit > 0 ? Math.min(segEnd, seg.ends - (digit - 1)) : segEnd;
        if (digitT1 <= digitT0 + EPS) digitT1 = Math.min(segEnd, digitT0 + 1);

        digitColor = digit <= 3 ? colors.live : digit <= 5 ? colors.warn : '#FFFFFF';
        if (isFirstDigit && idx > 0) {
          popTag = assPop(140, 100, 0, 240);
        } else if (digit <= 3) {
          popTag = assPop(135, 100, 0, 200);
        } else {
          popTag = assPop(112, 100, 0, 160);
        }

        lines.push(
          `Dialogue: 4,${formatAssTime(digitT0)},${formatAssTime(digitT1)},HUD,,0,0,0,,{\\pos(${ring.cx},${digitY})\\an5\\bord0\\shad0\\c${assInlineColor(digitColor)}${popTag}}{\\fs${digitFs}}${digit}{\\fs${unitFs}}s`,
        );

        // Red heartbeat glow behind the disc for the final three seconds
        if (digit > 0 && digit <= 3) {
          lines.push(
            `Dialogue: 0,${formatAssTime(digitT0)},${formatAssTime(digitT1)},Drawing,,0,0,0,,{\\pos(${ring.cx},${ring.cy})\\an5\\p1\\c${assInlineColor(colors.live)}\\1a${assAlpha(0.6)}\\bord0\\shad0\\blur14\\t(0,900,\\1a&HFF&\\fscx125\\fscy125)}${buildCirclePath(ring.r + 6, ring.r + 6, ring.r + 6)}`,
          );
        }
        isFirstDigit = false;
      }

      // 4. "RESET TO 10s" chip under the ring, throttled so rapid bidding doesn't strobe it
      if (idx > 0 && segStart - lastChipT0 >= CHIP_THROTTLE_S) {
        lastChipT0 = segStart;
        chipText = ring.reset_chip.replace('{window}', String(Math.round(seg.ends - seg.t)));
        chipW = measureAssTextWidth(chipText, CHIP_EM, 'heavy', 1.2) + 28;
        lines.push(
          ...buildPanelLines({
            layer: 4,
            t0: segStart,
            t1: Math.min(ringEnd, segStart + CHIP_SHOW_S),
            cx: ring.cx,
            cy: chipCy,
            w: chipW,
            h: CHIP_H,
            r: CHIP_H / 2,
            fill: colors.bid,
            shadow: SOFT_SHADOW,
            tags: `\\fscx60\\fscy60\\t(0,200,\\fscx100\\fscy100)${assFade(100, 250)}`,
          }),
        );
        lines.push(
          `Dialogue: 5,${formatAssTime(segStart)},${formatAssTime(Math.min(ringEnd, segStart + CHIP_SHOW_S))},HUD,,0,0,0,,{\\pos(${ring.cx},${assTextCenterY(chipCy, CHIP_EM)})\\an5\\bord0\\shad0\\c${assInlineColor(colors.ink)}\\fs${assFontSize(CHIP_EM)}\\fsp1.2${assFade(150, 250)}}${chipText}`,
        );
      }
    }

    // 5. Hold a red "0s" while the ring fades out after bidding closes
    if (ringHide > ringEnd + EPS) {
      lines.push(
        `Dialogue: 4,${formatAssTime(ringEnd)},${formatAssTime(ringHide)},HUD,,0,0,0,,{\\pos(${ring.cx},${digitY})\\an5\\bord0\\shad0\\c${assInlineColor(colors.live)}${assPop(130, 100, 0, 200)}${assFade(0, 300)}}{\\fs${digitFs}}0{\\fs${unitFs}}s`,
      );
    }

    return lines;
  } catch (error: any) {
    console.error(
      '[buildCountdownRingLines] Error:',
      error?.response?.data || error?.message || error,
    );
    return [];
  }
};
