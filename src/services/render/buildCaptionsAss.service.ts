import { ReelTimeline } from '../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../interfaces/theme.interface';
import { buildAssHeader } from '../../render/ass/header';
import { buildCaptionsLines } from '../../render/ass/components/captions';

export const buildCaptionsAssService = (tl: ReelTimeline, theme: ReelThemeVersion): string => {
  let header: string;
  let captionLines: string[];

  try {
    header = buildAssHeader(theme, `Captions - Stream ${tl.meta.stream_id} Lot ${tl.meta.lot_no}`);
    captionLines = buildCaptionsLines(tl, theme);

    return `${header}\n${captionLines.join('\n')}\n`;
  } catch (error: any) {
    console.error(
      '[buildCaptionsAssService] Error building Captions ASS subtitles:',
      error?.message || error,
    );
    throw error;
  }
};
