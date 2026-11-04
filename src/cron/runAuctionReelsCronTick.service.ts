import os from 'os';
import { AuctionReelJobModel } from '../models/auctionReelJob.model';
import { processAuctionReelJobService } from '../services/pipeline/processAuctionReelJob.service';
import { env } from '../config/env';

let activeRunningCount = 0;

export const getRunningJobCount = (): number => activeRunningCount;

export const setRunningJobCount = (val: number): void => {
  activeRunningCount = val;
};

export const runAuctionReelsCronTickService = async (customWorkerId?: string): Promise<number> => {
  let workerId: string;
  let maxLimit: number;
  let availableSlots: number;
  let activeJobs: any[];
  let launchedCount: number = 0;

  try {
    workerId = customWorkerId || `${os.hostname()}-${process.pid}`;
    maxLimit = env.MAX_JOB_LIMIT || 2;

    // 1. Check if number of running jobs < MAX_JOB_LIMIT
    if (activeRunningCount >= maxLimit) {
      console.log(
        `[runAuctionReelsCronTickService] Active jobs (${activeRunningCount}) >= MAX_JOB_LIMIT (${maxLimit}). Skipping tick.`,
      );
      return 0;
    }

    availableSlots = maxLimit - activeRunningCount;
    console.log(
      `[runAuctionReelsCronTickService] Capacity available: ${availableSlots} slot(s) free (${activeRunningCount}/${maxLimit} active).`,
    );

    // 2. Query Firestore database auction_reels_jobs where status is not completed or failed
    activeJobs = await AuctionReelJobModel.findActiveJobs(availableSlots);

    if (activeJobs.length === 0) {
      console.log('[runAuctionReelsCronTickService] No pending jobs to process.');
      return 0;
    }

    console.log(`[runAuctionReelsCronTickService] Claiming up to ${activeJobs.length} job(s)...`);

    // 3. Claim and launch pipeline for each job
    for (const job of activeJobs) {
      if (activeRunningCount >= maxLimit) {
        break;
      }

      const claimed = await AuctionReelJobModel.claimJob(job.stream_id, workerId);
      if (!claimed) {
        continue;
      }

      activeRunningCount++;
      launchedCount++;

      // Execute pipeline asynchronously
      (async () => {
        try {
          await processAuctionReelJobService(claimed);
        } catch (jobErr: any) {
          console.error(
            `[runAuctionReelsCronTickService] Error executing pipeline for stream ${claimed.stream_id}:`,
            jobErr?.message || jobErr,
          );
        } finally {
          activeRunningCount = Math.max(0, activeRunningCount - 1);
          try {
            await AuctionReelJobModel.releaseLease(claimed.stream_id, workerId);
          } catch (_relErr: any) {
            console.warn(
              `[runAuctionReelsCronTickService] Lease release warning for stream ${claimed.stream_id}:`,
              _relErr?.message || _relErr,
            );
          }
        }
      })();
    }

    return launchedCount;
  } catch (error: any) {
    console.error('[runAuctionReelsCronTickService] Tick error:', error?.message || error);
    return 0;
  }
};
