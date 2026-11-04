import { TranscriptWord, TranscriptSource } from '../../interfaces/transcript.interface';

let registeredSource: TranscriptSource | null = null;

export const setTranscriptSource = (source: TranscriptSource): void => {
  registeredSource = source;
};

export const fetchTranscriptWordsService = async (
  streamId: number,
  auctionId: string,
  window: { m0: number; m1: number },
): Promise<TranscriptWord[]> => {
  let source: TranscriptSource;
  let rawWords: TranscriptWord[];
  let adjustedWords: TranscriptWord[] = [];
  const { m0, m1 } = window;

  try {
    if (!registeredSource) {
      // Default fallback: empty words if no external transcript adapter is configured
      console.warn(
        `[fetchTranscriptWordsService] No TranscriptSource adapter registered for stream ${streamId}, returning empty array.`,
      );
      return [];
    }

    source = registeredSource;
    rawWords = await source.getWords(streamId, auctionId, window);

    if (source.timebase === 'stream') {
      // Convert stream timebase to clip seconds by subtracting m0 and filtering [m0, m1]
      for (const w of rawWords) {
        if (w.start >= m0 && w.start <= m1) {
          adjustedWords.push({
            ...w,
            start: w.start - m0,
            end: w.end !== undefined ? w.end - m0 : undefined,
          });
        }
      }
      return adjustedWords;
    }

    return rawWords;
  } catch (error: any) {
    console.error(
      '[fetchTranscriptWordsService] Error fetching transcript words:',
      error?.message || error,
      { streamId, auctionId, window },
    );
    throw error;
  }
};
