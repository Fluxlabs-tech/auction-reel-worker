import { AuctionReelJob } from '../../interfaces/job.interface';
import { transcribeStreamAudioService } from '../transcription/transcribeStreamAudio.service';
import { ingestStreamAuctionDataService } from '../auctionData/ingestStreamAuctionData.service';
import { processStreamLotsService } from '../lotReels/processStreamLots.service';
import { cleanupStreamScratchService } from '../media/cleanupStreamScratch.service';

export const processAuctionReelJobService = async (job: AuctionReelJob): Promise<void> => {
  let isTranscriptAvailable: boolean;
  let isAuctionDataPresent: boolean;

  try {
    console.log(
      `[processAuctionReelJobService] Evaluating pipeline for stream ${job.stream_id} (status: ${job.status})...`,
    );

    // 1. Stage 1: Check if transcript is available
    isTranscriptAvailable = Boolean(
      job.transcript &&
      job.transcript.status === 'COMPLETED' &&
      Boolean(job.transcript.storage_uri || job.transcript.gcs_prefix),
    );

    if (!isTranscriptAvailable) {
      console.log(
        `[processAuctionReelJobService] Stream ${job.stream_id} has no transcript. Invoking transcribe module...`,
      );
      await transcribeStreamAudioService(job);

      // Explicit requirement: on completion return from the function
      console.log(
        `[processAuctionReelJobService] Transcribe stage completed for stream ${job.stream_id}. Returning from function.`,
      );
      return;
    }

    // 2. Stage 2: If transcript is available -> check if auction data is present
    isAuctionDataPresent = Boolean(job.auction_data_present);

    if (!isAuctionDataPresent) {
      console.log(
        `[processAuctionReelJobService] Stream ${job.stream_id} has transcript but missing auction data. Ingesting from share-leaderboard...`,
      );
      await ingestStreamAuctionDataService(job);
      job.auction_data_present = true;
    }

    // 3. Stage 3: Process lots and render reels
    console.log(
      `[processAuctionReelJobService] Stream ${job.stream_id} auction data present. Processing lots...`,
    );
    await processStreamLotsService(job);
  } catch (error: any) {
    console.error(
      `[processAuctionReelJobService] Pipeline error for stream ${job.stream_id}:`,
      error?.message || error,
    );
    if (job.status === 'FAILED') {
      try {
        await cleanupStreamScratchService(job.stream_id);
      } catch (_cleanupErr) {
        // ignore
      }
    }
    throw error;
  }
};
