import fs from 'fs';
import axios from 'axios';
import { env } from '../../../config/env';
import { TranscriptWord } from '../../../interfaces/transcript.interface';

export const transcribeAudioZoopSttService = async (
  audioPathOrBuffer: string | Buffer,
  language?: string,
): Promise<TranscriptWord[]> => {
  let url: string;
  let headers: Record<string, string>;
  let formData: FormData;
  let audioBuffer: Buffer;
  let audioBlob: Blob;
  let response: any;
  let rawWords: any[];
  let rawChunks: any[];
  let words: TranscriptWord[] = [];

  try {
    url = `${env.STT_ZOOP_URL}/transcribe`;
    headers = {
      ...(env.STT_API_KEY ? { 'x-api-key': env.STT_API_KEY } : {}),
    };

    if (typeof audioPathOrBuffer === 'string') {
      audioBuffer = fs.readFileSync(audioPathOrBuffer);
    } else {
      audioBuffer = audioPathOrBuffer;
    }

    audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mp3' });
    formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    if (language) {
      formData.append('language', language);
    }

    response = await axios.post(url, formData, {
      headers,
      timeout: 180000,
    });

    rawWords = response.data?.words || [];
    rawChunks = response.data?.chunks || [];

    if (rawWords.length > 0) {
      for (const w of rawWords) {
        words.push({
          word: (w.word || w.text || '').trim(),
          start: typeof w.start === 'number' ? w.start : parseFloat(w.start) || 0,
          end: typeof w.end === 'number' ? w.end : parseFloat(w.end) || undefined,
        });
      }
    } else if (rawChunks.length > 0) {
      for (const chunk of rawChunks) {
        const chunkWords = (chunk.text || '').trim().split(/\s+/);
        const chunkStart = typeof chunk.start === 'number' ? chunk.start : 0;
        const chunkEnd = typeof chunk.end === 'number' ? chunk.end : chunkStart + 1;
        const wordDur = chunkWords.length > 0 ? (chunkEnd - chunkStart) / chunkWords.length : 0.5;

        for (let i = 0; i < chunkWords.length; i++) {
          if (!chunkWords[i]) continue;
          words.push({
            word: chunkWords[i],
            start: chunkStart + i * wordDur,
            end: chunkStart + (i + 1) * wordDur,
          });
        }
      }
    }

    return words;
  } catch (error: any) {
    console.error(
      '[transcribeAudioZoopSttService] Error transcribing with Zoop STT:',
      error?.response?.data || error?.message || error,
    );
    throw error;
  }
};
