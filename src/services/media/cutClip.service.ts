import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import pLimit from 'p-limit';
import { HlsSegment } from './parsePlaylist.service';
import { LotWindow } from '../../interfaces/lot.interface';
import { ensureSegmentDownloadedService } from './ensureSegmentDownloaded.service';
import { assertNonEmptyOutputService } from './assertNonEmptyOutput.service';
import { calculateBitrateBudgetService, BitrateBudget } from './calculateBitrateBudget.service';
import { env } from '../../config/env';

export const cutClipService = async (
  segs: HlsSegment[],
  window: LotWindow,
  targetDir: string,
  customSegmentsDir?: string,
): Promise<string> => {
  let needSegs: HlsSegment[];
  let segmentsDir: string;
  let limit: any;
  let downloadedPaths: string[] = [];
  let concatListFile: string;
  let clipPath: string;
  let ssOffset: number;
  let duration: number;
  let budget: BitrateBudget;
  let ffmpegArgs: string[];
  let ffmpegProcess: any;
  let stderrData: string = '';
  const { m0, m1 } = window;

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    segmentsDir = customSegmentsDir || path.join(path.dirname(targetDir), 'segments');
    if (!fs.existsSync(segmentsDir)) {
      fs.mkdirSync(segmentsDir, { recursive: true });
    }

    // Filter segments overlapping [m0, m1]
    needSegs = segs.filter((s) => s.media_start + s.dur > m0 && s.media_start < m1);

    if (needSegs.length === 0) {
      throw new Error(`No segments found for clip window [${m0}, ${m1}]`);
    }

    // Ensure required segments exist in shared pool (concurrency 8)
    limit = pLimit(8);
    await Promise.all(
      needSegs.map((s, idx) =>
        limit(async () => {
          const filePath = await ensureSegmentDownloadedService({
            segKey: s.key,
            segmentsDir,
          });
          downloadedPaths[idx] = filePath;
        }),
      ),
    );

    // Create concat demuxer list file
    concatListFile = path.join(targetDir, 'concat_list.txt');
    const listContent = downloadedPaths.map((p) => `file '${p}'`).join('\n');
    fs.writeFileSync(concatListFile, listContent, 'utf-8');

    clipPath = path.join(targetDir, 'clip.mp4');
    ssOffset = Math.max(0, m0 - needSegs[0].media_start);
    duration = Math.max(0.5, m1 - m0);

    // Dynamic bitrate budget so raw reel / cut clip also stays within 16MB
    budget = calculateBitrateBudgetService(duration, env.MAX_REEL_BYTES);

    ffmpegArgs = [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListFile,
      '-ss',
      ssOffset.toFixed(3),
      '-t',
      duration.toFixed(3),
      '-r',
      '30',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      String(budget.crf),
      '-maxrate',
      `${budget.videoMaxrateKbps}k`,
      '-bufsize',
      `${budget.bufsizeKbps}k`,
      '-c:a',
      'aac',
      '-b:a',
      `${budget.audioBitrateKbps}k`,
      clipPath,
    ];

    await new Promise<void>((resolve, reject) => {
      ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

      ffmpegProcess.stderr.on('data', (d: Buffer) => {
        stderrData += d.toString();
      });

      ffmpegProcess.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg cutClip failed with code ${code}: ${stderrData.slice(-500)}`));
        } else {
          resolve();
        }
      });

      ffmpegProcess.on('error', (err: any) => {
        reject(err);
      });
    });

    await assertNonEmptyOutputService(clipPath);

    return clipPath;
  } catch (error: any) {
    console.error('[cutClipService] Error cutting clip:', error?.message || error, {
      window,
      targetDir,
    });
    throw error;
  }
};
