import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import { AuctionReelJob, JobStep } from '../../interfaces/job.interface';
import { AuctionReelLot } from '../../interfaces/lot.interface';
import { AuctionReelLotModel } from '../../models/auctionReelLot.model';
import { ReelConfigModel } from '../../models/reelConfig.model';
import { downloadGcsObjectService, uploadGcsObjectService } from '../external';
import { buildTimelineService } from '../timeline/buildTimeline.service';
import { validateTimelineService } from '../timeline/validateTimeline.service';
import { loadThemeService } from '../render/loadTheme.service';
import { renderReelService } from '../render/renderReel.service';
import { probeDurationService } from '../media/probeDuration.service';
import { NotReadyError } from '../../errors';
import { LOT_RETRY_BACKOFF_MS, MAX_LOT_ATTEMPTS } from '../../config/defaults';
import { env } from '../../config/env';
import { getStreamGcsPrefix, getLotGcsPrefix } from './helpers';

const reconstructClock = (stored: any) => {
  const groups = stored.groups;
  return {
    method: stored.method,
    groups,
    toMedia: (wallTime: string | number | Date): number => {
      const wallMs = typeof wallTime === 'number' ? wallTime : new Date(wallTime).getTime();
      let selectedGroup = groups[0];
      for (const g of groups) {
        const estSec = (wallMs - g.w0) / 1000;
        if (estSec >= g.mediaStartMin && estSec <= g.mediaStartMax) {
          selectedGroup = g;
          break;
        }
      }
      return (wallMs - selectedGroup.w0) / 1000;
    },
    toWall: (mediaSec: number, groupIndex: number = 0): Date => {
      const g = groups.find((grp: any) => grp.group === groupIndex) || groups[0];
      return new Date(g.w0 + mediaSec * 1000);
    },
  };
};

export const renderLotsStepService = async (
  job: AuctionReelJob,
): Promise<{ next: JobStep; patch?: Partial<AuctionReelJob> }> => {
  let streamPrefix: string;
  let clockData: any;
  let clock: any;
  let cfg: any;
  let preparedLots: AuctionReelLot[];
  let limit: any;
  let anyRetryable: boolean;

  try {
    streamPrefix = getStreamGcsPrefix(job.stream_id, job.created_at);
    clockData = await downloadGcsObjectService(`${streamPrefix}clock.json`);
    clock = reconstructClock(clockData.clock);
    cfg = await ReelConfigModel.getCurrentConfig();

    preparedLots = await AuctionReelLotModel.listByStatus(job.stream_id, ['PREPARED']);
    limit = pLimit(env.LOT_CONCURRENCY || 2);

    await Promise.all(
      preparedLots.map((lot) =>
        limit(async () => {
          try {
            const lotDir = path.join(
              env.SCRATCH_DIR,
              String(job.stream_id),
              `${String(lot.lot_number).padStart(2, '0')}_${lot.id}`,
            );
            if (!fs.existsSync(lotDir)) {
              fs.mkdirSync(lotDir, { recursive: true });
            }

            const auctionUri =
              lot.artifacts.auction_json ||
              `${getLotGcsPrefix(job.stream_id, lot.lot_number, lot.id, job.created_at)}auction.json`;
            const wordsUri =
              lot.artifacts.words ||
              `${getLotGcsPrefix(job.stream_id, lot.lot_number, lot.id, job.created_at)}words.json`;

            const auctionData = await downloadGcsObjectService(auctionUri);
            const wordsData = await downloadGcsObjectService(wordsUri);

            // Ensure clip is local on scratch disk
            const localClipPath = path.join(lotDir, 'clip.mp4');
            if (!fs.existsSync(localClipPath) && lot.artifacts.clip) {
              const clipBuffer = await downloadGcsObjectService<Buffer>(lot.artifacts.clip, false);
              fs.writeFileSync(localClipPath, clipBuffer);
            }

            let clipDur: number | undefined;
            try {
              const probe = await probeDurationService(localClipPath);
              clipDur = probe.duration;
            } catch (_probeErr) {
              clipDur = undefined;
            }

            // Build timeline
            const timeline = buildTimelineService({
              auction: auctionData,
              words: wordsData,
              clock,
              window: lot.window || { m0: 0, m1: 60 },
              latency: job.latency || { seconds: 2.0, matches: 0, confidence: 'low' },
              lotNo: lot.lot_number,
              lotTotal: job.counts.total,
              clipDuration: clipDur,
              cfg,
            });

            // Validate timeline
            const flags = validateTimelineService(timeline, auctionData, job.latency);

            // Load pinned theme
            const themeResult = await loadThemeService(lot.theme);
            if (themeResult.fallback) {
              flags.push('THEME_FALLBACK');
            }

            // Render reel & thumbnail
            const renderResult = await renderReelService(
              localClipPath,
              timeline,
              themeResult.theme,
              lotDir,
            );

            // Upload artifacts to GCS
            const lotPrefix = getLotGcsPrefix(
              job.stream_id,
              lot.lot_number,
              lot.id,
              job.created_at,
            );

            const timelineUri = await uploadGcsObjectService(`${lotPrefix}timeline.json`, timeline);
            const reelBuffer = fs.readFileSync(renderResult.reelPath);
            const reelUri = await uploadGcsObjectService(
              `${lotPrefix}reel.mp4`,
              reelBuffer,
              'video/mp4',
            );

            let thumbUri: string | undefined;
            if (fs.existsSync(renderResult.thumbPath)) {
              const thumbBuffer = fs.readFileSync(renderResult.thumbPath);
              thumbUri = await uploadGcsObjectService(
                `${lotPrefix}thumb.jpg`,
                thumbBuffer,
                'image/jpeg',
              );
            }

            const finalStatus = flags.length > 0 ? 'NEEDS_REVIEW' : 'DONE';
            await AuctionReelLotModel.markRendered(job.stream_id, lot.id, finalStatus, {
              flags,
              artifacts: {
                ...lot.artifacts,
                timeline: timelineUri,
                reel: reelUri,
                thumbnail: thumbUri,
              },
              renderer_version: env.RENDERER_VERSION,
            });
          } catch (renderErr: any) {
            console.error(
              '[renderLotsStepService] Error rendering lot:',
              lot.id,
              renderErr?.message,
            );

            await AuctionReelLotModel.recordFailure(
              job.stream_id,
              lot.id,
              'render',
              renderErr?.message || 'Rendering failed',
              MAX_LOT_ATTEMPTS,
            );
          }
        }),
      ),
    );

    anyRetryable = await AuctionReelLotModel.anyRetryable(job.stream_id, 'render');
    if (anyRetryable) {
      throw new NotReadyError(
        LOT_RETRY_BACKOFF_MS,
        undefined,
        `Retrying rendering lots for stream ${job.stream_id}`,
      );
    }

    return {
      next: 'FINALIZE',
    };
  } catch (error: any) {
    if (error instanceof NotReadyError) {
      throw error;
    }
    console.error('[renderLotsStepService] Error rendering lots:', error?.message || error, {
      streamId: job.stream_id,
    });
    throw error;
  }
};
