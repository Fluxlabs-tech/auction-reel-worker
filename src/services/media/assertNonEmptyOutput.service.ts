import fs from 'fs';
import { spawn } from 'child_process';

export const assertNonEmptyOutputService = async (filePath: string): Promise<boolean> => {
  let stats: fs.Stats;
  let ffprobeProcess: any;
  let stdoutData: string = '';
  let stderrData: string = '';

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Output file does not exist: ${filePath}`);
    }

    stats = fs.statSync(filePath);
    if (stats.size < 1024) {
      throw new Error(`Output file is too small (${stats.size} bytes < 1KB): ${filePath}`);
    }

    // Verify stream presence using ffprobe
    await new Promise<void>((resolve, reject) => {
      ffprobeProcess = spawn('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type',
        '-of',
        'csv=p=0',
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
        } else if (!stdoutData.includes('video')) {
          reject(new Error(`Output file contains no video streams: ${stdoutData}`));
        } else {
          resolve();
        }
      });

      ffprobeProcess.on('error', (err: any) => {
        reject(err);
      });
    });

    return true;
  } catch (error: any) {
    console.error(
      '[assertNonEmptyOutputService] Error asserting valid output file:',
      error?.message || error,
      { filePath },
    );
    throw error;
  }
};
