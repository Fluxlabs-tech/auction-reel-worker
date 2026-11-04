import { chunkCaptionsService } from '../../src/services/timeline/chunkCaptions.service';
import { CleanedWord } from '../../src/interfaces/transcript.interface';

describe('chunkCaptionsService', () => {
  it('should chunk words respecting max_words and pause gaps', () => {
    const words: CleanedWord[] = [
      { word: 'Hello', text: 'Hello', start: 1.0, end: 1.4, kind: '' },
      { word: 'welcome', text: 'welcome', start: 1.45, end: 1.8, kind: '' },
      { word: 'to', text: 'to', start: 1.85, end: 2.0, kind: '' },
      { word: 'live', text: 'live', start: 2.05, end: 2.4, kind: '' },
      // 5th word exceeds max_words (4) -> new chunk
      { word: 'auction', text: 'auction', start: 2.45, end: 2.9, kind: '' },
      // gap of 1 second -> new chunk
      { word: 'starting', text: 'starting', start: 4.0, end: 4.4, kind: '' },
    ];

    const chunks = chunkCaptionsService(words, 4, 20, 0.45);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].words).toHaveLength(4);
    expect(chunks[1].words).toHaveLength(1);
    expect(chunks[2].words).toHaveLength(1);
  });
});
