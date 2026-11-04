import { spawn } from 'child_process';

export interface MediaProbeDetails {
  duration: number;
  width?: number;
  height?: number;
  hasAudio: boolean;
}

export const probeDurationService = async (filePath: string): Promise<MediaProbeDetails> => {
  let ffprobeProcess: any;
  let stdoutData: string = '';
  let stderrData: string = '';
  let duration: number;
  let parsed: any;
  let videoStream: any;
  let audioStream: any;

  try {
    parsed = await new Promise<any>((resolve, reject) => {
      ffprobeProcess = spawn('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration:stream=codec_type,width,height',
        '-of',
        'json',
        filePath,
      ]);

      ffprobeProcess.stdout.on('data', (d: Buffer) => {
        stdoutData += d.toString();
      });
      ffprobeProcess.stderr.on('data', (d: Buffer) => {
        stderrData += d.toString();
      });

      ffprobeProcess.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`ffprobe failed with code ${code}: ${stderrData}`));
        } else {
          try {
            resolve(JSON.parse(stdoutData));
          } catch (jsonErr) {
            reject(jsonErr);
          }
        }
      });

      ffprobeProcess.on('error', (err: any) => {
        reject(err);
      });
    });

    duration = parseFloat(parsed?.format?.duration) || 0;
    videoStream = (parsed?.streams || []).find((s: any) => s.codec_type === 'video');
    audioStream = (parsed?.streams || []).find((s: any) => s.codec_type === 'audio');

    return {
      duration,
      width: videoStream?.width,
      height: videoStream?.height,
      hasAudio: Boolean(audioStream),
    };
  } catch (error: any) {
    console.error('[probeDurationService] Error probing media:', error?.message || error, {
      filePath,
    });
    throw error;
  }
};
