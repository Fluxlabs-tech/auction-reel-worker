import { cleanWordsService } from '../../src/services/timeline/cleanWords.service';
import { TranscriptWord } from '../../src/interfaces/transcript.interface';
import { DEFAULT_REEL_CONFIG } from '../../src/config/defaults';

describe('cleanWordsService', () => {
  it('should fix out-of-order ASR timestamps', () => {
    const rawWords: TranscriptWord[] = [
      { word: 'now', start: 10.0 },
      { word: 'we', start: 5.379 }, // out of order inversion
      { word: 'have', start: 13.0 },
      { word: 'started', start: 13.5 },
    ];

    const cleaned = cleanWordsService(rawWords, DEFAULT_REEL_CONFIG);
    expect(cleaned).toHaveLength(4);
    // "we" should be repaired to between 10.0 and 13.0 (specifically ~12.75)
    expect(cleaned[1].start).toBeGreaterThan(cleaned[0].start);
    expect(cleaned[1].start).toBeLessThan(cleaned[2].start);
  });

  it('should apply asr_fixes mapping', () => {
    const rawWords: TranscriptWord[] = [
      { word: 'meters', start: 1.0 }, // should map to "me is"
    ];

    const cleaned = cleanWordsService(rawWords, {
      ...DEFAULT_REEL_CONFIG,
      asr_fixes: { meters: 'me is' },
    });

    expect(cleaned[0].word).toBe('me is');
  });

  it('should classify money and keywords', () => {
    const rawWords: TranscriptWord[] = [
      { word: 'starting', start: 1.0 },
      { word: '₹550', start: 1.5 },
      { word: 'with', start: 2.0 },
      { word: 'authentic', start: 2.5 },
    ];

    const cleaned = cleanWordsService(rawWords, DEFAULT_REEL_CONFIG);
    expect(cleaned[1].kind).toBe('money');
    expect(cleaned[3].kind).toBe('key');
  });
});
