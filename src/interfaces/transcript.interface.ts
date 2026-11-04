export interface TranscriptWord {
  word: string;
  start: number; // in seconds
  end?: number; // in seconds
  probability?: number;
}

export interface CleanedWord {
  word: string;
  text: string;
  start: number;
  end: number;
  kind: '' | 'money' | 'key' | 'low_conf';
  probability?: number;
}

export interface TranscriptSource {
  timebase: 'clip' | 'stream';
  getWords(
    streamId: number,
    auctionId: string,
    window: { m0: number; m1: number },
  ): Promise<TranscriptWord[]>;
}
