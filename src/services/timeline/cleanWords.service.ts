import { TranscriptWord, CleanedWord } from '../../interfaces/transcript.interface';
import { ReelConfig } from '../../interfaces/theme.interface';
import { parseAmountsService } from './parseAmounts.service';

export const cleanWordsService = (rawWords: TranscriptWord[], cfg: ReelConfig): CleanedWord[] => {
  let words: TranscriptWord[];
  let n: number;
  let cleaned: CleanedWord[] = [];
  let amounts: ReturnType<typeof parseAmountsService>;
  let moneyIndices: Set<number> = new Set();
  let keywordsSet: Set<string>;

  try {
    if (!rawWords || rawWords.length === 0) {
      return [];
    }

    // Clone words array to avoid mutating input
    words = rawWords.map((w) => ({ ...w }));
    n = words.length;

    // 1. Repair out-of-order ASR timestamps
    for (let i = 1; i < n; i++) {
      if (words[i].start < words[i - 1].start) {
        const nxt = i + 1 < n ? words[i + 1].start : words[i - 1].start + 0.4;
        if (nxt - words[i - 1].start > 1.5) {
          words[i].start = Math.round((nxt - 0.25) * 1000) / 1000;
        } else {
          words[i].start = Math.round(((words[i - 1].start + nxt) / 2) * 1000) / 1000;
        }
      }
    }

    // 2. Ensure monotone ascending starts
    for (let i = 1; i < n; i++) {
      if (words[i].start < words[i - 1].start) {
        words[i].start = words[i - 1].start + 0.05;
      }
    }

    // 3. Compute missing or invalid ends and apply asr_fixes
    for (let i = 0; i < n; i++) {
      const lower = words[i].word.toLowerCase().trim();
      if (cfg.asr_fixes && cfg.asr_fixes[lower]) {
        words[i].word = cfg.asr_fixes[lower];
      }

      const nextStart = i + 1 < n ? words[i + 1].start : Infinity;
      const computedEnd = words[i].start + 0.35 + 0.06 * words[i].word.length;

      if (!words[i].end || words[i].end! <= words[i].start) {
        words[i].end = Math.min(nextStart, computedEnd);
      } else {
        words[i].end = Math.min(nextStart, words[i].end!);
      }
      words[i].end = Math.round(words[i].end! * 1000) / 1000;
    }

    // 4. Mark money spans
    amounts = parseAmountsService(words);
    for (const amt of amounts) {
      for (let idx = amt.span[0]; idx <= amt.span[1]; idx++) {
        moneyIndices.add(idx);
      }
    }

    // 5. Keyword & confidence classification
    keywordsSet = new Set((cfg.keywords || []).map((k) => k.toLowerCase()));

    for (let i = 0; i < n; i++) {
      const w = words[i];
      const lowerWord = w.word.toLowerCase().replace(/[^a-z0-9]/g, '');
      let kind: '' | 'money' | 'key' | 'low_conf' = '';

      if (moneyIndices.has(i)) {
        kind = 'money';
      } else if (keywordsSet.has(lowerWord)) {
        kind = 'key';
      } else if (w.probability !== undefined && w.probability < 0.3) {
        kind = 'low_conf';
      }

      cleaned.push({
        word: w.word,
        text: w.word,
        start: w.start,
        end: w.end!,
        kind,
        probability: w.probability,
      });
    }

    return cleaned;
  } catch (error: any) {
    console.error('[cleanWordsService] Error cleaning transcript words:', error?.message || error);
    throw error;
  }
};
