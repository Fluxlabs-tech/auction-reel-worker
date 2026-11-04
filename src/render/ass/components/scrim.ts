import { ReelTimeline } from '../../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../../interfaces/theme.interface';
import { formatAssTime } from '../header';
import { assAlpha } from '../alphaTag';

// Soft top and bottom gradients (a heavily blurred black band that extends past the frame edge) so
// white HUD text and captions stay readable over bright sets without boxing the whole video.
export const buildScrimLines = (tl: ReelTimeline, theme: ReelThemeVersion): string[] => {
  let lines: string[] = [];
  let w: number;
  let h: number;
  let t0Str: string;
  let t1Str: string;

  try {
    w = theme.canvas?.w || 720;
    h = theme.canvas?.h || 1280;
    t0Str = formatAssTime(0);
    t1Str = formatAssTime(tl.end);

    lines.push(
      `Dialogue: 0,${t0Str},${t1Str},Drawing,,0,0,0,,{\\pos(0,0)\\an7\\p1\\c&H000000&\\1a${assAlpha(0.42)}\\bord0\\shad0\\blur70}m -100 -240 l ${w + 100} -240 ${w + 100} 250 -100 250`,
    );
    lines.push(
      `Dialogue: 0,${t0Str},${t1Str},Drawing,,0,0,0,,{\\pos(0,0)\\an7\\p1\\c&H000000&\\1a${assAlpha(0.34)}\\bord0\\shad0\\blur70}m -100 ${h - 210} l ${w + 100} ${h - 210} ${w + 100} ${h + 240} -100 ${h + 240}`,
    );

    return lines;
  } catch (error: any) {
    console.error('[buildScrimLines] Error:', error?.response?.data || error?.message || error);
    return [];
  }
};
