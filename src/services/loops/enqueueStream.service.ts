import { AuctionReelJobModel } from '../../models/auctionReelJob.model';
import { getStreamSummaryService } from '../external/getStreamSummary.service';
import { GIVE_UP_AFTER_MS } from '../../config/defaults';

export interface EnqueueStreamResult {
  job: any;
  alreadyExists: boolean;
}

export const enqueueStreamService = async (
  streamId: number,
  immediate: boolean = true,
): Promise<EnqueueStreamResult> => {
  let exists: boolean;
  let summary: any;
  let nowMs: number;
  let nextRunAt: number;
  let createdJob: any;
  let existingJob: any;

  try {
    exists = await AuctionReelJobModel.exists(streamId);
    if (exists) {
      existingJob = await AuctionReelJobModel.get(streamId);
      return {
        job: existingJob,
        alreadyExists: true,
      };
    }

    try {
      summary = await getStreamSummaryService(streamId);
    } catch (_sumErr) {
      summary = {};
    }

    nowMs = Date.now();
    nextRunAt = immediate ? nowMs : nowMs + 5 * 60 * 1000;

    createdJob = await AuctionReelJobModel.create(streamId, {
      seller_id: summary?.seller_id,
      store_id: summary?.store_identifier,
      step: 'WAITING',
      status: 'ACTIVE',
      next_run_at: nextRunAt,
      readiness: {
        auctions_closed: false,
        playlist_final: false,
        checked_at: new Date(nowMs).toISOString(),
        give_up_at: new Date(nowMs + GIVE_UP_AFTER_MS).toISOString(),
      },
    });

    return {
      job: createdJob,
      alreadyExists: false,
    };
  } catch (error: any) {
    console.error('[enqueueStreamService] Error enqueuing stream:', error?.message || error, {
      streamId,
    });
    throw error;
  }
};
