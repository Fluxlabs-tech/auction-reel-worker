import { AuctionReelJob } from '../../interfaces/job.interface';
import { AuctionReelLot } from '../../interfaces/lot.interface';
import { TranscriptWord } from '../../interfaces/transcript.interface';
import { AuctionReelJobModel } from '../../models/auctionReelJob.model';
import { AuctionReelLotModel } from '../../models/auctionReelLot.model';
import { downloadFromStorageService } from '../storage/downloadFromStorage.service';
import { getS3ObjectService } from '../external/s3/getS3Object.service';
import { parsePlaylistService, HlsSegment } from '../media/parsePlaylist.service';
import { buildStreamClockService, StreamClock } from '../media/buildStreamClock.service';
import { cleanupStreamScratchService } from '../media/cleanupStreamScratch.service';
import { renderSingleLotReelService } from './renderSingleLotReel.service';
import { publishAuctionReelEventService } from '../external/pubsub/publishAuctionReelEvent.service';
import { env } from '../../config/env';

export const processStreamLotsService = async (job: AuctionReelJob): Promise<void> => {
  let unprocessedLots: AuctionReelLot[] = [];
  let playlistKey: string;
  let playlistBuffer: Buffer;
  let segs: HlsSegment[] = [];
  let clock: StreamClock;
  let transcriptKey: string;
  let transcriptBuffer: Buffer;
  let allWords: TranscriptWord[] = [];
  let allLots: AuctionReelLot[] = [];
  let currentRetries: number;
  let newRetryCount: number;
  let artifacts: any;
  let errMsg: string;
  let terminalLots: AuctionReelLot[];
  let failedCount: number;
  let completedCount: number;

  try {
    console.log(`[processStreamLotsService] Scanning lots for stream ${job.stream_id}...`);

    unprocessedLots = await AuctionReelLotModel.getUnprocessedLots(job.stream_id);
    if (unprocessedLots.length === 0) {
      allLots = await AuctionReelLotModel.listAll(job.stream_id);
      if (allLots.length > 0) {
        console.log(
          `[processStreamLotsService] All ${allLots.length} lots already processed for stream ${job.stream_id}. Completing job.`,
        );
        await AuctionReelJobModel.markCompleted(job.stream_id);
      } else {
        console.log(
          `[processStreamLotsService] No lots exist for stream ${job.stream_id}. Marking SKIPPED.`,
        );
        await AuctionReelJobModel.markSkipped(job.stream_id, 'no_auctions');
        await publishAuctionReelEventService({
          status: 'SKIPPED',
          stream_id: job.stream_id,
          reason: 'no_auctions',
        });
      }
      await cleanupStreamScratchService(job.stream_id);
      return;
    }

    console.log(
      `[processStreamLotsService] Found ${unprocessedLots.length} unprocessed lots for stream ${job.stream_id}`,
    );

    // 1. Fetch playlist and construct clock
    playlistKey = `streams/${job.stream_id}/${job.stream_id}.m3u8`;
    playlistBuffer = await getS3ObjectService(playlistKey);
    segs = parsePlaylistService(playlistBuffer.toString('utf-8'), `streams/${job.stream_id}`);
    clock = await buildStreamClockService(job.stream_id, segs);

    // 2. Fetch transcript words from storage bucket
    transcriptKey =
      job.transcript?.storage_uri || `auction-reels/transcripts/${job.stream_id}/transcript.json`;
    try {
      transcriptBuffer = await downloadFromStorageService(transcriptKey);
      allWords = JSON.parse(transcriptBuffer.toString('utf-8'));
    } catch (_trErr) {
      console.warn(
        `[processStreamLotsService] Could not load transcript from ${transcriptKey}, using empty word list.`,
      );
      allWords = [];
    }

    // 3. Process each unprocessed lot with 3-retry threshold
    for (const lot of unprocessedLots) {
      if (lot.status === 'SKIPPED') {
        console.log(`[processStreamLotsService] Lot ${lot.id} is already marked SKIPPED.`);
        continue;
      }

      currentRetries = lot.retry_count || 0;

      if (currentRetries >= env.LOT_MAX_RETRIES) {
        console.warn(
          `[processStreamLotsService] Lot ${lot.id} exceeded max retries (${currentRetries}/${env.LOT_MAX_RETRIES}). Marking FAILED.`,
        );
        errMsg = `Exceeded maximum retries (${env.LOT_MAX_RETRIES})`;
        await AuctionReelLotModel.markFailed(job.stream_id, lot.id, errMsg);
        continue;
      }

      console.log(
        `[processStreamLotsService] Rendering lot ${lot.lot_number} (${lot.id}), attempt ${currentRetries + 1}/${env.LOT_MAX_RETRIES}...`,
      );

      newRetryCount = await AuctionReelLotModel.incrementRetry(job.stream_id, lot.id);

      try {
        artifacts = await renderSingleLotReelService(job, lot, allWords, clock, segs);
        await AuctionReelLotModel.markCompleted(job.stream_id, lot.id, artifacts);
        console.log(
          `[processStreamLotsService] Successfully completed reel for lot ${lot.id}: reel=${artifacts.reelUri}, raw=${artifacts.rawReelUri}`,
        );
      } catch (renderError: any) {
        errMsg = renderError?.message || 'Reel render failure';
        console.error(
          `[processStreamLotsService] Error rendering lot ${lot.id} on attempt ${newRetryCount}:`,
          errMsg,
        );

        if (newRetryCount >= env.LOT_MAX_RETRIES) {
          console.error(
            `[processStreamLotsService] Marking lot ${lot.id} as FAILED after ${newRetryCount} failed attempts.`,
          );
          await AuctionReelLotModel.markFailed(job.stream_id, lot.id, errMsg);
        } else {
          // Keep as retryable for the next tick
          await AuctionReelLotModel.markFailed(job.stream_id, lot.id, errMsg);
        }
      }
    }

    // 4. Check if all lots for this stream are terminal
    allLots = await AuctionReelLotModel.listAll(job.stream_id);
    terminalLots = allLots.filter(
      (l) => l.status === 'COMPLETED' || l.status === 'FAILED' || l.status === 'SKIPPED',
    );

    if (terminalLots.length === allLots.length && allLots.length > 0) {
      failedCount = allLots.filter((l) => l.status === 'FAILED').length;
      completedCount = allLots.filter((l) => l.status === 'COMPLETED').length;

      console.log(
        `[processStreamLotsService] All lots terminal for stream ${job.stream_id} (${completedCount} completed, ${failedCount} failed). Finalizing job.`,
      );

      await AuctionReelJobModel.markCompleted(job.stream_id, {
        total: allLots.length,
        completed: completedCount,
        failed: failedCount,
      });

      // Cleanup local scratch dir for this stream
      await cleanupStreamScratchService(job.stream_id);

      // Trigger stream-level Pub/Sub event when all lots of a stream are done processing
      await publishAuctionReelEventService({
        status: completedCount === 0 && failedCount > 0 ? 'FAILED' : 'DONE',
        stream_id: job.stream_id,
        counts: {
          total: allLots.length,
          completed: completedCount,
          failed: failedCount,
        },
      });
    }
  } catch (error: any) {
    console.error(
      `[processStreamLotsService] Error in lot reel processing for stream ${job.stream_id}:`,
      error?.message || error,
    );
    throw error;
  }
};
