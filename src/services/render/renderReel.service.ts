import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ReelTimeline } from '../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../interfaces/theme.interface';
import { buildHudAssService } from './buildHudAss.service';
import { buildCaptionsAssService } from './buildCaptionsAss.service';
import { buildFilterGraphService } from './buildFilterGraph.service';
import { assertNonEmptyOutputService } from '../media/assertNonEmptyOutput.service';
import { env } from '../../config/env';

export interface RenderReelResult {
  reelPath: string;
  thumbPath: string;
  hudAssPath: string;
  captionsAssPath: string;
}

export const renderReelService = async (
  clipPath: string,
  tl: ReelTimeline,
  theme: ReelThemeVersion,
  outDir: string,
): Promise<RenderReelResult> => {
  let hudAssPath: string;
  let captionsAssPath: string;
  let reelPath: string;
  let thumbPath: string;
  let hudAssText: string;
  let captionsAssText: string;
  let filterGraphRes: ReturnType<typeof buildFilterGraphService>;
  let ffmpegArgs: string[];
  let ffmpegProcess: any;
  let stderrData: string = '';
  let thumbArgs: string[];
  let thumbProcess: any;
  let thumbStderr: string = '';

  try {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    hudAssPath = path.join(outDir, 'hud.ass');
    captionsAssPath = path.join(outDir, 'captions.ass');
    reelPath = path.join(outDir, 'reel.mp4');
    thumbPath = path.join(outDir, 'thumb.jpg');

    // 1. Write ASS subtitle files
    hudAssText = buildHudAssService(tl, theme);
    captionsAssText = buildCaptionsAssService(tl, theme);
    fs.writeFileSync(hudAssPath, hudAssText, 'utf-8');
    fs.writeFileSync(captionsAssPath, captionsAssText, 'utf-8');

    // 2. Build filter complex graph
    filterGraphRes = buildFilterGraphService(tl, theme, hudAssPath, captionsAssPath);

    // 3. Assemble ffmpeg arguments
    ffmpegArgs = [
      '-y',
      '-i',
      clipPath,
      ...filterGraphRes.inputs,
      '-filter_complex',
      filterGraphRes.graph,
      '-map',
      '[vout]',
      '-map',
      '0:a?',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-threads',
      String(env.RENDER_THREADS || 4),
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-t',
      tl.end.toFixed(3),
      '-movflags',
      '+faststart',
      reelPath,
    ];

    // 4. Execute ffmpeg with timeout guard
    await new Promise<void>((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        try {
          if (ffmpegProcess) ffmpegProcess.kill('SIGKILL');
        } catch (_killErr) {
          // ignore kill errors
        }
        reject(
          new Error(
            `ffmpeg renderReel timed out after ${env.RENDER_TIMEOUT_MS}ms for clip ${clipPath}`,
          ),
        );
      }, env.RENDER_TIMEOUT_MS);

      ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

      ffmpegProcess.stderr.on('data', (d: Buffer) => {
        stderrData += d.toString();
      });

      ffmpegProcess.on('close', (code: number) => {
        clearTimeout(timeoutTimer);
        if (code !== 0) {
          reject(
            new Error(`ffmpeg renderReel failed with code ${code}: ${stderrData.slice(-800)}`),
          );
        } else {
          resolve();
        }
      });

      ffmpegProcess.on('error', (err: any) => {
        clearTimeout(timeoutTimer);
        reject(err);
      });
    });

    await assertNonEmptyOutputService(reelPath);

    // 5. Generate thumbnail at result reveal (result.t + 0.6s)
    const thumbTime = Math.min(tl.end - 0.2, (tl.result?.t || 10) + 0.6);
    thumbArgs = [
      '-y',
      '-ss',
      thumbTime.toFixed(3),
      '-i',
      reelPath,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      thumbPath,
    ];

    await new Promise<void>((resolve, _reject) => {
      thumbProcess = spawn('ffmpeg', thumbArgs);
      thumbProcess.stderr.on('data', (d: Buffer) => {
        thumbStderr += d.toString();
      });
      thumbProcess.on('close', (code: number) => {
        if (code !== 0) {
          console.warn(
            `[renderReelService] Thumbnail generation warning: ${thumbStderr.slice(-300)}`,
          );
          resolve();
        } else {
          resolve();
        }
      });
      thumbProcess.on('error', (err: any) => {
        console.warn('[renderReelService] Thumbnail process error:', err?.message || err);
        resolve();
      });
    });

    return {
      reelPath,
      thumbPath,
      hudAssPath,
      captionsAssPath,
    };
  } catch (error: any) {
    console.error('[renderReelService] Error rendering reel:', error?.message || error, {
      clipPath,
      outDir,
    });
    throw error;
  }
};
