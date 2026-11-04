import { CleanedWord } from '../../interfaces/transcript.interface';
import { ReelConfig } from '../../interfaces/theme.interface';
import { parseAmountsService } from './parseAmounts.service';

export interface MatchedCue {
  id: string;
  t0: number;
  t1: number;
  amount?: number;
}

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

const tokenMatches = (actual: string, pattern: string): boolean => {
  if (actual === pattern) return true;
  if (pattern.length >= 5 && Math.abs(actual.length - pattern.length) <= 1) {
    return levenshtein(actual, pattern) <= 1;
  }
  return false;
};

export const matchCuesService = (words: CleanedWord[], cfg: ReelConfig): MatchedCue[] => {
  let toks: string[];
  let matchedList: MatchedCue[] = [];
  let seenCueIds: Set<string> = new Set();

  try {
    toks = words.map((w) => (w.text || w.word).toLowerCase().replace(/[^a-z0-9]/g, ''));

    for (const cue of cfg.cues || []) {
      if (seenCueIds.has(cue.id)) continue;

      let found = false;

      for (const pattern of cue.patterns) {
        if (found) break;
        const patLen = pattern.length;

        for (let i = 0; i <= toks.length - patLen; i++) {
          let patMatches = true;

          for (let j = 0; j < patLen; j++) {
            const expectedToken = pattern[j].toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!tokenMatches(toks[i + j], expectedToken)) {
              patMatches = false;
              break;
            }
          }

          if (patMatches) {
            let capturedAmount: number | undefined;

            if (cue.capture_amount_within && cue.capture_amount_within > 0) {
              const followTokens = words.slice(i + patLen, i + patLen + cue.capture_amount_within);
              const amounts = parseAmountsService(followTokens);
              if (amounts.length > 0) {
                capturedAmount = amounts[0].value;
              }
            }

            matchedList.push({
              id: cue.id,
              t0: Math.round(words[i].start * 1000) / 1000,
              t1: Math.round((words[i].start + cue.duration_s) * 1000) / 1000,
              amount: capturedAmount,
            });

            seenCueIds.add(cue.id);
            found = true;
            break;
          }
        }
      }
    }

    return matchedList;
  } catch (error: any) {
    console.error('[matchCuesService] Error matching cues:', error?.message || error);
    return [];
  }
};
