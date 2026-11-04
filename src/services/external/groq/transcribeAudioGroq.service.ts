import fs from 'fs';
import axios from 'axios';
import { env } from '../../../config/env';
import { TranscriptWord } from '../../../interfaces/transcript.interface';

export const transcribeAudioGroqService = async (
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
  let words: TranscriptWord[] = [];
  let model: string;

  try {
    if (!env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured in environment');
    }

    url = 'https://api.groq.com/openai/v1/audio/transcriptions';
    headers = {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    };

    if (typeof audioPathOrBuffer === 'string') {
      audioBuffer = fs.readFileSync(audioPathOrBuffer);
    } else {
      audioBuffer = audioPathOrBuffer;
    }

    model = (env.GROQ_MODEL || 'whisper-large-v3-turbo').trim();
    if (model === 'whisper-turbo-v3' || model === 'whisper-turbo') {
      model = 'whisper-large-v3-turbo';
    }

    audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mp3' });
    formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', model);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');
    if (language) {
      formData.append('language', language);
    }

    response = await axios.post(url, formData, {
      headers,
      timeout: 180000, // 3 minutes
    });

    rawWords = response.data?.words || [];
    if (rawWords.length > 0) {
      for (const w of rawWords) {
        words.push({
          word: (w.word || w.text || '').trim(),
          start: typeof w.start === 'number' ? w.start : parseFloat(w.start) || 0,
          end: typeof w.end === 'number' ? w.end : parseFloat(w.end) || undefined,
        });
      }
    } else if (response.data?.segments) {
      for (const seg of response.data.segments) {
        const segWords = (seg.text || '').trim().split(/\s+/);
        const segStart = typeof seg.start === 'number' ? seg.start : 0;
        const segEnd = typeof seg.end === 'number' ? seg.end : segStart + 1;
        const wordDur = segWords.length > 0 ? (segEnd - segStart) / segWords.length : 0.5;

        for (let i = 0; i < segWords.length; i++) {
          if (!segWords[i]) continue;
          words.push({
            word: segWords[i],
            start: segStart + i * wordDur,
            end: segStart + (i + 1) * wordDur,
          });
        }
      }
    }

    return words;
  } catch (error: any) {
    console.error(
      '[transcribeAudioGroqService] Error transcribing with Groq:',
      error?.response?.data || error?.message || error,
    );
    throw error;
  }
};
