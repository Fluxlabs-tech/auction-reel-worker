import { AuctionReelJob, JobStep } from '../../interfaces/job.interface';
import { AuctionReelLotModel } from '../../models/auctionReelLot.model';
import { cleanupStreamScratchService } from '../media/cleanupStreamScratch.service';
import { publishAuctionReelEventService } from '../external/pubsub/publishAuctionReelEvent.service';

export const finalizeStepService = async (
  job: AuctionReelJob,
): Promise<{ next: JobStep; patch: Partial<AuctionReelJob> }> => {
  let counts: any;
  let finalStatus: 'DONE' | 'PARTIAL';
  let eventStatus: 'DONE' | 'FAILED' | 'SKIPPED';

  try {
    // 1. Clean up local scratch directory
    await cleanupStreamScratchService(job.stream_id);

    // 2. Compute final counts from lots
    counts = await AuctionReelLotModel.countsByStatus(job.stream_id);
    finalStatus = counts.failed > 0 ? 'PARTIAL' : 'DONE';

    if (counts.total === 0) {
      eventStatus = 'SKIPPED';
    } else if (counts.done + counts.needs_review === 0 && counts.failed > 0) {
      eventStatus = 'FAILED';
    } else {
      eventStatus = 'DONE';
    }

    // Trigger stream-level Pub/Sub event now that all lots of a stream are done processing
    await publishAuctionReelEventService({
      status: eventStatus,
      stream_id: job.stream_id,
      counts,
      reason: eventStatus === 'SKIPPED' ? 'no_auctions' : undefined,
    });

    return {
      next: 'DONE',
      patch: {
        status: finalStatus,
        counts,
        updated_at: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    console.error('[finalizeStepService] Error finalizing stream:', error?.message || error, {
      streamId: job.stream_id,
    });
    throw error;
  }
};
