import path from 'path';
import { spawn } from 'child_process';
import { assertNonEmptyOutputService } from './assertNonEmptyOutput.service';

export const extractAudioService = async (
  videoPath: string,
  outputDir: string,
): Promise<string> => {
  let audioPath: string;
  let ffmpegArgs: string[];
  let ffmpegProcess: any;
  let stderrData: string = '';

  try {
    audioPath = path.join(outputDir, 'audio.wav');
    ffmpegArgs = [
      '-y',
      '-i',
      videoPath,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '16000',
      '-ac',
      '1',
      audioPath,
    ];

    await new Promise<void>((resolve, reject) => {
      ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

      ffmpegProcess.stderr.on('data', (d: Buffer) => {
        stderrData += d.toString();
      });

      ffmpegProcess.on('close', (code: number) => {
        if (code !== 0) {
          reject(
            new Error(`ffmpeg extractAudio failed with code ${code}: ${stderrData.slice(-500)}`),
          );
        } else {
          resolve();
        }
      });

      ffmpegProcess.on('error', (err: any) => {
        reject(err);
      });
    });

    await assertNonEmptyOutputService(audioPath);
    return audioPath;
  } catch (error: any) {
    console.error('[extractAudioService] Error extracting audio:', error?.message || error, {
      videoPath,
    });
    throw error;
  }
};
