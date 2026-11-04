import { dispatchTranscriptionService } from '../../src/services/transcription/dispatchTranscription.service';
import * as zoopSttModule from '../../src/services/external/zoopStt/transcribeAudioZoopStt.service';
import * as groqModule from '../../src/services/external/groq/transcribeAudioGroq.service';
import * as openRouterModule from '../../src/services/external/openRouter/transcribeAudioOpenRouter.service';
import { env } from '../../src/config/env';

jest.mock('../../src/services/external/zoopStt/transcribeAudioZoopStt.service');
jest.mock('../../src/services/external/groq/transcribeAudioGroq.service');
jest.mock('../../src/services/external/openRouter/transcribeAudioOpenRouter.service');

describe('dispatchTranscriptionService', () => {
  const originalProvider = env.STT_PROVIDER;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    env.STT_PROVIDER = originalProvider;
  });

  it('should route to Zoop internal STT when STT_PROVIDER is zoop', async () => {
    env.STT_PROVIDER = 'zoop';
    const mockWords = [{ word: 'zoop', start: 0, end: 1 }];
    (zoopSttModule.transcribeAudioZoopSttService as jest.Mock).mockResolvedValue(mockWords);

    const words = await dispatchTranscriptionService('/tmp/audio.mp3', 'hi');

    expect(zoopSttModule.transcribeAudioZoopSttService).toHaveBeenCalledWith(
      '/tmp/audio.mp3',
      'hi',
    );
    expect(groqModule.transcribeAudioGroqService).not.toHaveBeenCalled();
    expect(openRouterModule.transcribeAudioOpenRouterService).not.toHaveBeenCalled();
    expect(words).toEqual(mockWords);
  });

  it('should route to Groq Whisper when STT_PROVIDER is groq', async () => {
    env.STT_PROVIDER = 'groq';
    const mockWords = [{ word: 'groq', start: 0, end: 1 }];
    (groqModule.transcribeAudioGroqService as jest.Mock).mockResolvedValue(mockWords);

    const words = await dispatchTranscriptionService('/tmp/audio.mp3', 'en');

    expect(groqModule.transcribeAudioGroqService).toHaveBeenCalledWith('/tmp/audio.mp3', 'en');
    expect(zoopSttModule.transcribeAudioZoopSttService).not.toHaveBeenCalled();
    expect(openRouterModule.transcribeAudioOpenRouterService).not.toHaveBeenCalled();
    expect(words).toEqual(mockWords);
  });

  it('should route to OpenRouter when STT_PROVIDER is openrouter', async () => {
    env.STT_PROVIDER = 'openrouter';
    const mockWords = [{ word: 'openrouter', start: 0, end: 1 }];
    (openRouterModule.transcribeAudioOpenRouterService as jest.Mock).mockResolvedValue(mockWords);

    const words = await dispatchTranscriptionService('/tmp/audio.mp3');

    expect(openRouterModule.transcribeAudioOpenRouterService).toHaveBeenCalledWith(
      '/tmp/audio.mp3',
      undefined,
    );
    expect(groqModule.transcribeAudioGroqService).not.toHaveBeenCalled();
    expect(zoopSttModule.transcribeAudioZoopSttService).not.toHaveBeenCalled();
    expect(words).toEqual(mockWords);
  });
});
