import { AuctionReelJobModel } from '../../models/auctionReelJob.model';
import { STEP_HANDLERS } from '../steps';
import { NotReadyError, FatalError } from '../../errors';
import {
  DEFAULT_LEASE_MS,
  LEASE_RENEW_INTERVAL_MS,
  MAX_STEP_ATTEMPTS,
} from '../../config/defaults';

export const runWorkerTickService = async (
  workerId: string,
  onJobStarted?: (streamId: number, step: string) => void,
  onJobFinished?: () => void,
): Promise<boolean> => {
  let job: any;
  let renewInterval: NodeJS.Timeout | null = null;
  let nowMs: number;
  let stepFn: any;
  let stepResult: any;

  try {
    nowMs = Date.now();
    job = await AuctionReelJobModel.claimNextDue(workerId, DEFAULT_LEASE_MS);
    if (!job) {
      return false; // No due job
    }

    if (onJobStarted) {
      onJobStarted(job.stream_id, job.step);
    }

    // Set up periodic lease renewal
    renewInterval = setInterval(async () => {
      try {
        await AuctionReelJobModel.renewLease(job.stream_id, workerId, DEFAULT_LEASE_MS);
      } catch (renewErr: any) {
        console.warn(
          `[runWorkerTickService] Lease renewal failed for stream ${job.stream_id}:`,
          renewErr?.message || renewErr,
        );
      }
    }, LEASE_RENEW_INTERVAL_MS);

    stepFn = STEP_HANDLERS[job.step];
    if (!stepFn) {
      throw new FatalError(`Unknown or unhandled step: ${job.step}`);
    }

    stepResult = await stepFn(job);

    await AuctionReelJobModel.advance(job.stream_id, workerId, {
      ...(stepResult.patch || {}),
      step: stepResult.next,
    });

    return true;
  } catch (error: any) {
    nowMs = Date.now();

    if (error instanceof NotReadyError) {
      await AuctionReelJobModel.reschedule(
        job.stream_id,
        workerId,
        nowMs + error.retryInMs,
        error.patch,
      );
    } else if (error instanceof FatalError) {
      console.error(
        `[runWorkerTickService] Fatal error on stream ${job.stream_id} (${job.step}):`,
        error.message,
      );
      await AuctionReelJobModel.fail(job.stream_id, workerId, error.message);
    } else {
      const currentAttempts = (job.attempts?.[job.step] ?? 0) + 1;
      const maxAttempts = MAX_STEP_ATTEMPTS[job.step] ?? 3;
      const errorMessage = error?.message || 'Step execution error';

      console.error(
        `[runWorkerTickService] Error on stream ${job.stream_id} (${job.step}), attempt ${currentAttempts}/${maxAttempts}:`,
        errorMessage,
      );

      if (currentAttempts >= maxAttempts) {
        await AuctionReelJobModel.fail(job.stream_id, workerId, errorMessage);
      } else {
        // Exponential backoff: 2^n minutes
        const backoffMs = Math.pow(2, currentAttempts) * 60 * 1000;
        await AuctionReelJobModel.backoff(
          job.stream_id,
          workerId,
          currentAttempts,
          nowMs + backoffMs,
          errorMessage,
        );
      }
    }

    return true;
  } finally {
    if (renewInterval) {
      clearInterval(renewInterval);
    }
    if (onJobFinished) {
      onJobFinished();
    }
  }
};
