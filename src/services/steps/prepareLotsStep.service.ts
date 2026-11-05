import path from 'path';
import fs from 'fs';
import pLimit from 'p-limit';
import { AuctionReelJob, JobStep } from '../../interfaces/job.interface';
import { AuctionReelLot } from '../../interfaces/lot.interface';
import { AuctionReelLotModel } from '../../models/auctionReelLot.model';
import { ReelConfigModel } from '../../models/reelConfig.model';
import {
  downloadGcsObjectService,
  uploadGcsObjectService,
  fetchTranscriptWordsService,
} from '../external';
import { clipWindowService } from '../media/clipWindow.service';
import { cutClipService } from '../media/cutClip.service';
import { cleanWordsService } from '../timeline/cleanWords.service';
import { NotReadyError } from '../../errors';
import { LOT_RETRY_BACKOFF_MS, MAX_LOT_ATTEMPTS } from '../../config/defaults';
import { env } from '../../config/env';
import { getLotGcsPrefix, getStreamGcsPrefix } from './helpers';

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

export const prepareLotsStepService = async (
  job: AuctionReelJob,
): Promise<{ next: JobStep; patch: Partial<AuctionReelJob> }> => {
  let streamPrefix: string;
  let clockData: any;
  let segs: any[];
  let clock: any;
  let pendingLots: AuctionReelLot[];
  let allLots: AuctionReelLot[];
  let segmentsDir: string;
  let cfg: any;
  let limit: any;
  let anyRetryable: boolean;
  let preparedCount: number;

  try {
    streamPrefix = getStreamGcsPrefix(job.stream_id, job.created_at);
    clockData = await downloadGcsObjectService(`${streamPrefix}clock.json`);
    segs = clockData.segs;
    clock = reconstructClock(clockData.clock);

    cfg = await ReelConfigModel.getCurrentConfig();
    pendingLots = await AuctionReelLotModel.listByStatus(job.stream_id, ['PENDING']);
    allLots = await AuctionReelLotModel.listAll(job.stream_id);
    segmentsDir = path.join(env.SCRATCH_DIR, String(job.stream_id), 'segments');

    limit = pLimit(env.LOT_CONCURRENCY || 2);

    await Promise.all(
      pendingLots.map((lot) =>
        limit(async () => {
          try {
            const lotIdx = allLots.findIndex((l) => l.id === lot.id);
            const prevLot = lotIdx > 0 ? allLots[lotIdx - 1] : null;
            const nextLot = lotIdx < allLots.length - 1 ? allLots[lotIdx + 1] : null;

            const auctionData = await downloadGcsObjectService(
              lot.artifacts.auction_json ||
                `${getLotGcsPrefix(job.stream_id, lot.lot_number, lot.id, job.created_at)}auction.json`,
            );

            const lotWindow = clipWindowService(
              auctionData,
              clock,
              cfg.latency.prior_s,
              cfg.window,
              prevLot ? prevLot.summary : null,
              nextLot ? nextLot.summary : null,
            );

            const scratchDir = path.join(
              env.SCRATCH_DIR,
              String(job.stream_id),
              `${String(lot.lot_number).padStart(2, '0')}_${lot.id}`,
            );

            // Cut clip using ffmpeg
            const localClipPath = await cutClipService(segs, lotWindow, scratchDir, segmentsDir);

            // Fetch & clean transcript
            const rawWords = await fetchTranscriptWordsService(job.stream_id, lot.id, lotWindow);
            const cleanedWords = cleanWordsService(rawWords, cfg);

            // Upload clip and words to GCS
            const lotPrefix = getLotGcsPrefix(
              job.stream_id,
              lot.lot_number,
              lot.id,
              job.created_at,
            );
            const clipBuffer = fs.readFileSync(localClipPath);
            const clipGcsUri = await uploadGcsObjectService(
              `${lotPrefix}clip.mp4`,
              clipBuffer,
              'video/mp4',
            );
            const wordsGcsUri = await uploadGcsObjectService(
              `${lotPrefix}words.json`,
              cleanedWords,
            );

            await AuctionReelLotModel.markPrepared(job.stream_id, lot.id, {
              window: lotWindow,
              artifacts: {
                ...lot.artifacts,
                clip: clipGcsUri,
                words: wordsGcsUri,
              },
            });
          } catch (lotErr: any) {
            console.error('[prepareLotsStepService] Error preparing lot:', lot.id, lotErr?.message);
            await AuctionReelLotModel.recordFailure(
              job.stream_id,
              lot.id,
              'prepare',
              lotErr?.message || 'Preparation failed',
              MAX_LOT_ATTEMPTS,
            );
          }
        }),
      ),
    );

    anyRetryable = await AuctionReelLotModel.anyRetryable(job.stream_id, 'prepare');
    if (anyRetryable) {
      throw new NotReadyError(
        LOT_RETRY_BACKOFF_MS,
        undefined,
        `Retrying pending lots for stream ${job.stream_id}`,
      );
    }

    preparedCount = await AuctionReelLotModel.count(job.stream_id, 'PREPARED');

    return {
      next: 'CALIBRATE',
      patch: {
        counts: {
          ...job.counts,
          prepared: preparedCount,
        },
        updated_at: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    if (error instanceof NotReadyError) {
      throw error;
    }
    console.error('[prepareLotsStepService] Error preparing lots:', error?.message || error, {
      streamId: job.stream_id,
    });
    throw error;
  }
};
