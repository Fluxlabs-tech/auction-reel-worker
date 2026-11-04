import { AuctionReelJob, JobStep } from '../../interfaces/job.interface';
import { AuctionReelLotModel } from '../../models/auctionReelLot.model';
import { cleanupStreamScratchService } from '../media/cleanupStreamScratch.service';

export const finalizeStepService = async (
  job: AuctionReelJob,
): Promise<{ next: JobStep; patch: Partial<AuctionReelJob> }> => {
  let counts: any;
  let finalStatus: 'DONE' | 'PARTIAL';

  try {
    // 1. Clean up local scratch directory
    await cleanupStreamScratchService(job.stream_id);

    // 2. Compute final counts from lots
    counts = await AuctionReelLotModel.countsByStatus(job.stream_id);
    finalStatus = counts.failed > 0 ? 'PARTIAL' : 'DONE';

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
