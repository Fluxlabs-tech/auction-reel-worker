import { AuctionReelJob, JobStep } from '../../interfaces/job.interface';
import { getStreamAuctionTimelineService, getS3ObjectService } from '../external';
import { NotReadyError, FatalError } from '../../errors';
import { WAITING_NOT_READY_BACKOFF_MS, GIVE_UP_AFTER_MS } from '../../config/defaults';

export const waitingStepService = async (
  job: AuctionReelJob,
): Promise<{ next: JobStep; patch: Partial<AuctionReelJob> }> => {
  let timeline: any;
  let allClosed: boolean;
  let playlistKey: string;
  let playlistBuffer: Buffer | null = null;
  let playlistFinal: boolean = false;
  let nowMs: number;
  let nowStr: string;
  let giveUpAtMs: number;
  let readinessPatch: any;

  try {
    nowMs = Date.now();
    nowStr = new Date(nowMs).toISOString();

    // 1. Check all auctions are closed/settled
    timeline = await getStreamAuctionTimelineService(job.stream_id);
    allClosed =
      timeline.auctions.length > 0 &&
      timeline.auctions.every((a: any) => ['closed', 'settled'].includes(a.status));

    // 2. Check playlist has reached #EXT-X-ENDLIST
    playlistKey = `streams/${job.stream_id}/${job.stream_id}.m3u8`;
    try {
      playlistBuffer = await getS3ObjectService(playlistKey);
      playlistFinal = playlistBuffer.toString('utf-8').includes('#EXT-X-ENDLIST');
    } catch (_s3Err: any) {
      playlistFinal = false; // fail closed
    }

    readinessPatch = {
      readiness: {
        auctions_closed: allClosed,
        playlist_final: playlistFinal,
        checked_at: nowStr,
        give_up_at: job.readiness?.give_up_at || new Date(nowMs + GIVE_UP_AFTER_MS).toISOString(),
      },
    };

    if (!(allClosed && playlistFinal)) {
      giveUpAtMs = job.readiness?.give_up_at
        ? new Date(job.readiness.give_up_at).getTime()
        : nowMs + GIVE_UP_AFTER_MS;

      if (nowMs > giveUpAtMs) {
        throw new FatalError(
          `Stream ${job.stream_id} timed out waiting for auctions to close and playlist to end.`,
        );
      }

      throw new NotReadyError(
        WAITING_NOT_READY_BACKOFF_MS,
        readinessPatch,
        `Stream ${job.stream_id} waiting for completion (closed: ${allClosed}, final: ${playlistFinal})`,
      );
    }

    return {
      next: 'FETCH_AUCTIONS',
      patch: readinessPatch,
    };
  } catch (error: any) {
    if (error instanceof NotReadyError || error instanceof FatalError) {
      throw error;
    }
    console.error(
      '[waitingStepService] Error checking stream readiness:',
      error?.message || error,
      {
        streamId: job.stream_id,
      },
    );
    throw error;
  }
};
