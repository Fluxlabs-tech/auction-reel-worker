import { CleanedWord } from '../../interfaces/transcript.interface';
import { TimelineCaptionChunk } from '../../interfaces/timeline.interface';

export const chunkCaptionsService = (
  words: CleanedWord[],
  maxWords: number = 4,
  maxChars: number = 20,
  gapSec: number = 0.45,
): TimelineCaptionChunk[] => {
  let chunks: Array<{ words: CleanedWord[]; chars: number }> = [];
  let currentChunk: { words: CleanedWord[]; chars: number } = { words: [], chars: 0 };
  let result: TimelineCaptionChunk[] = [];

  try {
    if (!words || words.length === 0) {
      return [];
    }

    for (const w of words) {
      const wText = w.text || w.word;
      const wLen = wText.length;
      const lastWord =
        currentChunk.words.length > 0 ? currentChunk.words[currentChunk.words.length - 1] : null;

      const shouldBreak =
        lastWord !== null &&
        (w.start - lastWord.end > gapSec ||
          currentChunk.words.length >= maxWords ||
          currentChunk.chars + wLen > maxChars);

      if (shouldBreak) {
        chunks.push(currentChunk);
        currentChunk = { words: [], chars: 0 };
      }

      currentChunk.words.push(w);
      currentChunk.chars += wLen + (currentChunk.words.length > 1 ? 1 : 0);
    }

    if (currentChunk.words.length > 0) {
      chunks.push(currentChunk);
    }

    // Assign chunk start and end boundaries with smooth padding
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const first = c.words[0];
      const last = c.words[c.words.length - 1];

      const t0 = Math.max(0, first.start - 0.06);

      let t1Target = last.end + 0.4;
      if (i + 1 < chunks.length) {
        const nextFirst = chunks[i + 1].words[0];
        const nextT0 = Math.max(0, nextFirst.start - 0.06);
        t1Target = Math.min(t1Target, nextT0 - 0.03);
      }

      const t1 = Math.max(t0 + 0.1, t1Target);

      result.push({
        t0: Math.round(t0 * 1000) / 1000,
        t1: Math.round(t1 * 1000) / 1000,
        words: c.words.map((w) => ({
          t0: Math.round(w.start * 1000) / 1000,
          t1: Math.round(w.end * 1000) / 1000,
          text: w.text || w.word,
          kind: w.kind || '',
        })),
      });
    }

    return result;
  } catch (error: any) {
    console.error('[chunkCaptionsService] Error chunking captions:', error?.message || error);
    return [];
  }
};
