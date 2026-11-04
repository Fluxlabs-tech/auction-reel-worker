import { ReelTimeline } from '../../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../../interfaces/theme.interface';
import { formatAssTime, assInlineColor } from '../header';

export const buildCaptionsLines = (tl: ReelTimeline, theme: ReelThemeVersion): string[] => {
  const lines: string[] = [];
  const caps = theme.components.captions;
  if (!caps || !caps.enabled) return lines;

  const chunks = tl.captions || [];

  for (const chunk of chunks) {
    const chunkWords = chunk.words;
    if (chunkWords.length === 0) continue;

    // Generate one dialogue line per word's active interval
    for (let activeIdx = 0; activeIdx < chunkWords.length; activeIdx++) {
      const activeWord = chunkWords[activeIdx];
      const t0Str = formatAssTime(activeWord.t0);
      const t1Str = formatAssTime(activeWord.t1);

      const formattedWords: string[] = [];

      for (let j = 0; j < chunkWords.length; j++) {
        const w = chunkWords[j];
        const text = caps.uppercase ? w.text.toUpperCase() : w.text;

        if (j === activeIdx) {
          // Active word: yellow highlight with gentle pop
          formattedWords.push(
            `{\\c${assInlineColor(theme.tokens.colors.accent)}\\t(0,140,\\fscx116\\fscy116)}${text}{\\fscx100\\fscy100}`,
          );
        } else if (w.kind === 'money') {
          // Money word: green
          formattedWords.push(`{\\c${assInlineColor(theme.tokens.colors.bid)}}${text}`);
        } else if (w.kind === 'key') {
          // Keyword word: teal
          formattedWords.push(`{\\c${assInlineColor(theme.tokens.colors.key)}}${text}`);
        } else {
          // Inactive standard word: white
          formattedWords.push(`{\\c${assInlineColor('#FFFFFF')}}${text}`);
        }
      }

      const fullChunkText = formattedWords.join(' \\h ');
      lines.push(`Dialogue: 1,${t0Str},${t1Str},Captions,,0,0,0,,${fullChunkText}`);
    }
  }

  return lines;
};
