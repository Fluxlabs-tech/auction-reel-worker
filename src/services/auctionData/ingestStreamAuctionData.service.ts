import { AuctionReelJob } from '../../interfaces/job.interface';
import { fetchAndSaveAuctionDataService } from './fetchAndSaveAuctionData.service';

export const ingestStreamAuctionDataService = async (job: AuctionReelJob): Promise<void> => {
  try {
    await fetchAndSaveAuctionDataService(job.stream_id);
  } catch (error: any) {
    console.error(
      `[ingestStreamAuctionDataService] Error ingesting auction data for stream ${job.stream_id}:`,
      error?.message || error,
    );
    throw error;
  }
};
