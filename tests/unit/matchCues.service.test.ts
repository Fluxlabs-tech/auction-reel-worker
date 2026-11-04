import { matchCuesService } from '../../src/services/timeline/matchCues.service';
import { CleanedWord } from '../../src/interfaces/transcript.interface';
import { DEFAULT_REEL_CONFIG } from '../../src/config/defaults';

describe('matchCuesService', () => {
  it('should match cues from word sequences and extract amount', () => {
    const words: CleanedWord[] = [
      { word: 'first', text: 'first', start: 2.4, end: 2.8, kind: '' },
      { word: 'article', text: 'article', start: 2.9, end: 3.3, kind: '' },
      { word: 'cash', text: 'cash', start: 10.0, end: 10.4, kind: '' },
      { word: 'on', text: 'on', start: 10.5, end: 10.7, kind: '' },
      { word: 'delivery', text: 'delivery', start: 10.8, end: 11.2, kind: '' },
      { word: 'above', text: 'above', start: 11.3, end: 11.6, kind: '' },
      { word: '500', text: '500', start: 11.7, end: 12.0, kind: 'money' },
    ];

    const cues = matchCuesService(words, DEFAULT_REEL_CONFIG);
    expect(cues.length).toBeGreaterThanOrEqual(2);

    const firstItem = cues.find((c) => c.id === 'first_item');
    expect(firstItem).toBeDefined();
    expect(firstItem?.t0).toBe(2.4);

    const codCue = cues.find((c) => c.id === 'cod');
    expect(codCue).toBeDefined();
    expect(codCue?.amount).toBe(500);
  });
});
