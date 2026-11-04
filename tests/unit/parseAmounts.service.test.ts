import { parseAmountsService } from '../../src/services/timeline/parseAmounts.service';
import { TranscriptWord } from '../../src/interfaces/transcript.interface';

describe('parseAmountsService', () => {
  it('should parse direct numeric tokens', () => {
    const words: TranscriptWord[] = [
      { word: 'Price', start: 1.0 },
      { word: '550', start: 1.5 },
      { word: 'rupees', start: 2.0 },
      { word: '₹1000', start: 3.0 },
      { word: '2k', start: 4.0 },
    ];

    const amounts = parseAmountsService(words);
    expect(amounts).toHaveLength(3);
    expect(amounts[0]).toEqual({ t: 1.5, value: 550, span: [1, 1] });
    expect(amounts[1]).toEqual({ t: 3.0, value: 1000, span: [3, 3] });
    expect(amounts[2]).toEqual({ t: 4.0, value: 2000, span: [4, 4] });
  });

  it('should parse Hindi word sequences e.g. "chhe sau", "paanch sau pachaas"', () => {
    const words: TranscriptWord[] = [
      { word: 'chhe', start: 10.0 },
      { word: 'sau', start: 10.4 },
      { word: 'and', start: 11.0 },
      { word: 'paanch', start: 12.0 },
      { word: 'sau', start: 12.4 },
      { word: 'pachaas', start: 12.8 },
    ];

    const amounts = parseAmountsService(words);
    expect(amounts).toHaveLength(2);
    expect(amounts[0]).toEqual({ t: 10.0, value: 600, span: [0, 1] });
    expect(amounts[1]).toEqual({ t: 12.0, value: 550, span: [3, 5] });
  });

  it('should parse Indian English shorthand e.g. "five fifty"', () => {
    const words: TranscriptWord[] = [
      { word: 'five', start: 20.0 },
      { word: 'fifty', start: 20.5 },
    ];

    const amounts = parseAmountsService(words);
    expect(amounts).toHaveLength(1);
    expect(amounts[0]).toEqual({ t: 20.0, value: 550, span: [0, 1] });
  });

  it('should parse fractional amounts e.g. "dedh sau"', () => {
    const words: TranscriptWord[] = [
      { word: 'dedh', start: 30.0 },
      { word: 'sau', start: 30.4 },
    ];

    const amounts = parseAmountsService(words);
    expect(amounts).toHaveLength(1);
    expect(amounts[0]).toEqual({ t: 30.0, value: 150, span: [0, 1] });
  });
});
