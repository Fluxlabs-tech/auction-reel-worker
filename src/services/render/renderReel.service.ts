import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ReelTimeline } from '../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../interfaces/theme.interface';
import { buildHudAssService } from './buildHudAss.service';
import { buildCaptionsAssService } from './buildCaptionsAss.service';
import { buildFilterGraphService } from './buildFilterGraph.service';
import { assertNonEmptyOutputService } from '../media/assertNonEmptyOutput.service';
import {
  calculateBitrateBudgetService,
  BitrateBudget,
} from '../media/calculateBitrateBudget.service';
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
  let budget: BitrateBudget;
  let ffmpegArgs: string[];
  let ffmpegProcess: any;
  let stderrData: string = '';
  let reelStats: fs.Stats;
  let maxBytesLimit: number;
  let recodePath: string;
  let recodeStderr: string = '';
  let safeVideoKbps: number;
  let recodeArgs: string[];
  let recodeProcess: any;
  let thumbTime: number;
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

    // 3. Compute duration-based VBV bitrate budget (target 15MB for WhatsApp 16MB limit)
    budget = calculateBitrateBudgetService(tl.end, env.MAX_REEL_BYTES);

    // 4. Assemble ffmpeg arguments with dynamic rate limits
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
      'fast',
      '-crf',
      String(budget.crf),
      '-maxrate',
      `${budget.videoMaxrateKbps}k`,
      '-bufsize',
      `${budget.bufsizeKbps}k`,
      '-threads',
      String(env.RENDER_THREADS || 4),
      '-c:a',
      'aac',
      '-b:a',
      `${budget.audioBitrateKbps}k`,
      '-t',
      tl.end.toFixed(3),
      '-movflags',
      '+faststart',
      reelPath,
    ];

    // 5. Execute ffmpeg with timeout guard
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

    // 6. Failsafe check: verify output file size does not exceed 16MB limit
    maxBytesLimit = 16 * 1024 * 1024;
    reelStats = fs.statSync(reelPath);
    if (reelStats.size > maxBytesLimit) {
      console.warn(
        `[renderReelService] Reel ${reelPath} exceeded 16MB limit (${reelStats.size} bytes). Executing safety recode pass...`,
      );
      recodePath = path.join(outDir, 'reel_recode.mp4');
      recodeStderr = '';
      safeVideoKbps = Math.floor(budget.videoMaxrateKbps * 0.9);
      recodeArgs = [
        '-y',
        '-i',
        reelPath,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-b:v',
        `${safeVideoKbps}k`,
        '-maxrate',
        `${safeVideoKbps}k`,
        '-bufsize',
        `${safeVideoKbps}k`,
        '-c:a',
        'copy',
        '-movflags',
        '+faststart',
        recodePath,
      ];

      await new Promise<void>((resolve) => {
        recodeProcess = spawn('ffmpeg', recodeArgs);
        recodeProcess.stderr.on('data', (d: Buffer) => {
          recodeStderr += d.toString();
        });
        recodeProcess.on('close', (code: number) => {
          if (code !== 0) {
            console.error(
              `[renderReelService] Failsafe recode warning: ${recodeStderr.slice(-400)}`,
            );
            resolve();
          } else {
            if (fs.existsSync(recodePath)) {
              fs.renameSync(recodePath, reelPath);
            }
            resolve();
          }
        });
        recodeProcess.on('error', (err: any) => {
          console.error('[renderReelService] Failsafe recode spawn error:', err?.message || err);
          resolve();
        });
      });
    }

    // 7. Generate thumbnail at result reveal (result.t + 0.6s)
    thumbTime = Math.min(tl.end - 0.2, (tl.result?.t || 10) + 0.6);
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
