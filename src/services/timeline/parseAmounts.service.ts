import { TranscriptWord } from '../../interfaces/transcript.interface';

export interface ParsedAmount {
  t: number;
  value: number;
  span: [number, number]; // [startIdx, endIdx] inclusive
}

const NUMBER_WORDS: Record<string, number> = {
  // Hindi & English units / tens
  zero: 0,
  shunya: 0,
  ek: 1,
  one: 1,
  do: 2,
  two: 2,
  teen: 3,
  three: 3,
  char: 4,
  chaar: 4,
  four: 4,
  paanch: 5,
  panch: 5,
  five: 5,
  chhe: 6,
  che: 6,
  six: 6,
  saat: 7,
  seven: 7,
  aath: 8,
  eight: 8,
  nau: 9,
  nine: 9,
  das: 10,
  ten: 10,
  gyarah: 11,
  eleven: 11,
  barah: 12,
  twelve: 12,
  terah: 13,
  thirteen: 13,
  chaudah: 14,
  fourteen: 14,
  pandrah: 15,
  fifteen: 15,
  solah: 16,
  sixteen: 16,
  satrah: 17,
  seventeen: 17,
  atharah: 18,
  eighteen: 18,
  unnis: 19,
  nineteen: 19,
  bees: 20,
  twenty: 20,
  tees: 30,
  thirty: 30,
  chalis: 40,
  chaalis: 40,
  forty: 40,
  pachaas: 50,
  pachas: 50,
  fifty: 50,
  saath: 60,
  sath: 60,
  sixty: 60,
  sattar: 70,
  seventy: 70,
  assi: 80,
  eighty: 80,
  nabbe: 90,
  ninety: 90,
};

const MULTIPLIERS: Record<string, number> = {
  sau: 100,
  hundred: 100,
  hazaar: 1000,
  hazar: 1000,
  thousand: 1000,
  k: 1000,
  lakh: 100000,
  lac: 100000,
};

const FRACTIONS: Record<string, number> = {
  dedh: 1.5,
  dhai: 2.5,
  sawa: 1.25,
};

const cleanToken = (str: string): string => {
  return str.toLowerCase().replace(/[^a-z0-9₹]/g, '');
};

export const parseAmountsService = (words: TranscriptWord[]): ParsedAmount[] => {
  let results: ParsedAmount[] = [];
  let n: number;
  let i: number = 0;

  try {
    n = words.length;

    while (i < n) {
      let matched: boolean = false;
      const w0 = cleanToken(words[i].word || '');

      // 1. Direct regex match on single token: e.g. "550", "₹1,000", "600rs", "2k"
      const directNumericMatch = w0.match(/^₹?(\d{1,7})(k|rs|rupees)?$/);
      if (directNumericMatch) {
        let val = parseInt(directNumericMatch[1], 10);
        if (directNumericMatch[2] === 'k') {
          val *= 1000;
        }
        if (val >= 1 && val <= 1000000) {
          results.push({
            t: words[i].start,
            value: val,
            span: [i, i],
          });
          i++;
          continue;
        }
      }

      // Check multi-token combinations over up to 4 words [i, i+3]
      const maxLen = Math.min(4, n - i);

      // Try longest match downwards from maxLen to 2
      for (let len = maxLen; len >= 2; len--) {
        const tokens = words.slice(i, i + len).map((w) => cleanToken(w.word || ''));

        // Case A: <fract> <mult> e.g. "dedh sau" (150), "dhai hazaar" (2500)
        if (len === 2 && FRACTIONS[tokens[0]] && MULTIPLIERS[tokens[1]]) {
          const val = Math.round(FRACTIONS[tokens[0]] * MULTIPLIERS[tokens[1]]);
          if (val >= 1 && val <= 1000000) {
            results.push({
              t: words[i].start,
              value: val,
              span: [i, i + 1],
            });
            i += 2;
            matched = true;
            break;
          }
        }

        // Case B: <unit> <mult> [<unit|tens>] e.g. "chhe sau" (600), "paanch sau pachaas" (550), "six hundred"
        if (NUMBER_WORDS[tokens[0]] !== undefined && MULTIPLIERS[tokens[1]]) {
          let val = NUMBER_WORDS[tokens[0]] * MULTIPLIERS[tokens[1]];
          let spanEnd = i + 1;

          if (len >= 3 && NUMBER_WORDS[tokens[2]] !== undefined) {
            val += NUMBER_WORDS[tokens[2]];
            spanEnd = i + 2;

            if (len === 4 && NUMBER_WORDS[tokens[3]] !== undefined) {
              val += NUMBER_WORDS[tokens[3]];
              spanEnd = i + 3;
            }
          }

          if (val >= 1 && val <= 1000000) {
            results.push({
              t: words[i].start,
              value: val,
              span: [i, spanEnd],
            });
            i = spanEnd + 1;
            matched = true;
            break;
          }
        }

        // Case C: Indian shorthand <unit> <tens> e.g. "five fifty" (550), "four twenty" (420), "paanch pachaas"
        if (
          len === 2 &&
          NUMBER_WORDS[tokens[0]] !== undefined &&
          NUMBER_WORDS[tokens[0]] < 10 &&
          NUMBER_WORDS[tokens[1]] !== undefined &&
          NUMBER_WORDS[tokens[1]] >= 20 &&
          NUMBER_WORDS[tokens[1]] <= 90
        ) {
          const val = NUMBER_WORDS[tokens[0]] * 100 + NUMBER_WORDS[tokens[1]];
          if (val >= 1 && val <= 1000000) {
            results.push({
              t: words[i].start,
              value: val,
              span: [i, i + 1],
            });
            i += 2;
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        i++;
      }
    }

    return results;
  } catch (error: any) {
    console.error(
      '[parseAmountsService] Error parsing amounts from words:',
      error?.message || error,
    );
    return [];
  }
};
