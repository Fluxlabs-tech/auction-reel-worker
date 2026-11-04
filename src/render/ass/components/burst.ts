import { ReelTimeline } from '../../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../../interfaces/theme.interface';
import { formatAssTime, assInlineColor } from '../header';
import { assFontSize } from '../fontSize';
import { assTextCenterY } from '../textCenterY';
import { measureAssTextWidth } from '../measureAssText';
import { buildPanelLines } from '../panel';

const BURST_EM = 38;
const BURST_H = 82;
const BURST_CY = 640;
const TILT_DEG = -4;
const DEPTH_PX = 8;
const FINALE_LEAD_S = 0.22; // keep in step with the finale's lead-in so banners never overlap the stamp

// Moment banners ("BIDDING IS LIVE!", "TIME'S UP!"): a tilted, solid sticker banner with a hard ink
// drop that slams in and fades — replaces bare outlined text that blurred into the video.
export const buildBurstLines = (tl: ReelTimeline, theme: ReelThemeVersion): string[] => {
  let lines: string[] = [];
  let bursts: ReelThemeVersion['components']['bursts'];
  let canvasW: number;
  let cx: number;
  let specs: Array<{ text: string; t0: number; t1: number; fill: string; ink: string }> = [];
  let spec: { text: string; t0: number; t1: number; fill: string; ink: string };
  let w: number;
  let slamTag: string;
  let tFinale: number;
  let durMs: number;

  try {
    bursts = theme.components.bursts;
    if (!bursts) return lines;

    canvasW = theme.canvas?.w || 720;
    cx = canvasW / 2;
    tFinale = tl.result ? Math.max(0, tl.result.t - FINALE_LEAD_S) : tl.end;

    if (tl.live && bursts.live) {
      specs.push({
        text: bursts.live,
        t0: tl.live.t,
        t1: tl.live.t + 2.2,
        fill: theme.tokens.colors.live,
        ink: '#FFFFFF',
      });
    }
    if (tl.close && bursts.close) {
      specs.push({
        text: bursts.close,
        t0: tl.close.t,
        t1: tl.close.t + 1.7,
        fill: theme.tokens.colors.warn,
        ink: theme.tokens.colors.ink,
      });
    }

    for (spec of specs) {
      // A burst must clear before the SOLD finale lands (close -> result can be < 1s apart)
      spec.t1 = Math.min(spec.t1, tl.end, spec.t0 < tFinale ? tFinale : tl.end);
      if (spec.t1 - spec.t0 < 0.45) continue;
      durMs = Math.round((spec.t1 - spec.t0) * 1000);
      // Slam in, then shrink out: fading a stacked banner would turn it see-through mid-exit
      slamTag =
        `\\frz${TILT_DEG}\\fscx40\\fscy40\\t(0,160,\\fscx110\\fscy110)\\t(160,260,\\fscx100\\fscy100)` +
        `\\t(${durMs - 170},${durMs},0.6,\\fscx0\\fscy0)\\fad(80,0)`;
      w = measureAssTextWidth(spec.text, BURST_EM, 'heavy', 1) + 72;

      // Hard ink "depth" block, then the banner
      lines.push(
        ...buildPanelLines({
          layer: 8,
          t0: spec.t0,
          t1: spec.t1,
          cx,
          cy: BURST_CY + DEPTH_PX,
          w,
          h: BURST_H,
          r: 22,
          fill: theme.tokens.colors.ink,
          fillOpacity: 0.55,
          tags: slamTag,
        }),
      );
      lines.push(
        ...buildPanelLines({
          layer: 8,
          t0: spec.t0,
          t1: spec.t1,
          cx,
          cy: BURST_CY,
          w,
          h: BURST_H,
          r: 22,
          fill: spec.fill,
          tags: slamTag,
        }),
      );
      lines.push(
        `Dialogue: 9,${formatAssTime(spec.t0)},${formatAssTime(spec.t1)},Burst,,0,0,0,,{\\pos(${cx},${assTextCenterY(BURST_CY, BURST_EM)})\\an5\\org(${cx},${BURST_CY})\\bord0\\shad0\\c${assInlineColor(spec.ink)}\\fs${assFontSize(BURST_EM)}\\fsp1${slamTag}}${spec.text}`,
      );
    }

    return lines;
  } catch (error: any) {
    console.error('[buildBurstLines] Error:', error?.response?.data || error?.message || error);
    return [];
  }
};
