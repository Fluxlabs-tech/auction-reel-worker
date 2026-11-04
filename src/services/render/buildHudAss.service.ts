import { ReelTimeline } from '../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../interfaces/theme.interface';
import { buildAssHeader } from '../../render/ass/header';
import {
  buildScrimLines,
  buildIntroLines,
  buildHudLines,
  buildBidCardLines,
  buildCountdownRingLines,
  buildCueChipLines,
  buildStickerLines,
  buildBurstLines,
  buildConfettiLines,
  buildFinaleLines,
} from '../../render/ass/components';

export const buildHudAssService = (tl: ReelTimeline, theme: ReelThemeVersion): string => {
  let header: string;
  let allLines: string[] = [];

  try {
    header = buildAssHeader(theme, `HUD - Stream ${tl.meta.stream_id} Lot ${tl.meta.lot_no}`);

    allLines.push(...buildScrimLines(tl, theme));
    allLines.push(...buildIntroLines(tl, theme));
    allLines.push(...buildHudLines(tl, theme));
    allLines.push(...buildBidCardLines(tl, theme));
    allLines.push(...buildCountdownRingLines(tl, theme));
    allLines.push(...buildCueChipLines(tl, theme));
    allLines.push(...buildStickerLines(tl, theme));
    allLines.push(...buildBurstLines(tl, theme));
    allLines.push(...buildConfettiLines(tl, theme));
    allLines.push(...buildFinaleLines(tl, theme));

    return `${header}\n${allLines.join('\n')}\n`;
  } catch (error: any) {
    console.error(
      '[buildHudAssService] Error building HUD ASS subtitles:',
      error?.message || error,
    );
    throw error;
  }
};
