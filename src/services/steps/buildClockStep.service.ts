import { AuctionReelJob, JobStep } from '../../interfaces/job.interface';
import { getS3ObjectService } from '../external/getS3Object.service';
import { parsePlaylistService } from '../media/parsePlaylist.service';
import { buildStreamClockService } from '../media/buildStreamClock.service';
import { uploadGcsObjectService } from '../external/uploadGcsObject.service';
import { getStreamGcsPrefix } from './helpers';

export const buildClockStepService = async (
  job: AuctionReelJob,
): Promise<{ next: JobStep; patch: Partial<AuctionReelJob> }> => {
  let playlistKey: string;
  let playlistBuffer: Buffer;
  let segs: any[];
  let clock: any;
  let streamPrefix: string;
  let clockGcsUri: string;

  try {
    playlistKey = `streams/${job.stream_id}/${job.stream_id}.m3u8`;
    playlistBuffer = await getS3ObjectService(playlistKey);
    segs = parsePlaylistService(playlistBuffer.toString('utf-8'));

    clock = await buildStreamClockService(job.stream_id, segs);

    streamPrefix = getStreamGcsPrefix(job.stream_id, job.created_at);
    clockGcsUri = await uploadGcsObjectService(`${streamPrefix}clock.json`, {
      segs,
      clock: {
        method: clock.method,
        groups: clock.groups,
      },
    });

    return {
      next: 'PREPARE_LOTS',
      patch: {
        clock: {
          method: clock.method,
          gcs_uri: clockGcsUri,
        },
        updated_at: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    console.error('[buildClockStepService] Error building clock:', error?.message || error, {
      streamId: job.stream_id,
    });
    throw error;
  }
};
