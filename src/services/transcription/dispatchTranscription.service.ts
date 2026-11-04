import { env } from '../../config/env';
import { TranscriptWord } from '../../interfaces/transcript.interface';
import { transcribeAudioZoopSttService } from '../external/zoopStt';
import { transcribeAudioGroqService } from '../external/groq';
import { transcribeAudioOpenRouterService } from '../external/openRouter';

export const dispatchTranscriptionService = async (
  audioPathOrBuffer: string | Buffer,
  language?: string,
): Promise<TranscriptWord[]> => {
  let provider: string;
  let words: TranscriptWord[];

  try {
    provider = env.STT_PROVIDER?.toLowerCase() || 'zoop';

    console.log(`[dispatchTranscriptionService] Routing audio to STT provider: ${provider}`);

    switch (provider) {
      case 'groq':
        words = await transcribeAudioGroqService(audioPathOrBuffer, language);
        break;

      case 'openrouter':
        words = await transcribeAudioOpenRouterService(audioPathOrBuffer, language);
        break;

      case 'zoop':
      default:
        words = await transcribeAudioZoopSttService(audioPathOrBuffer, language);
        break;
    }

    console.log(
      `[dispatchTranscriptionService] Transcription completed via ${provider} with ${words.length} words`,
    );
    return words;
  } catch (error: any) {
    console.error('[dispatchTranscriptionService] Error executing transcription dispatch:', {
      error: error?.message || error,
      provider: env.STT_PROVIDER,
    });
    throw error;
  }
};
