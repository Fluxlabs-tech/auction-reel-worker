import { processAuctionReelJobService } from '../../src/services/pipeline/processAuctionReelJob.service';
import * as transcribeModule from '../../src/services/transcription/transcribeStreamAudio.service';
import * as auctionDataModule from '../../src/services/auctionData/ingestStreamAuctionData.service';
import * as lotReelsModule from '../../src/services/lotReels/processStreamLots.service';
import { AuctionReelJob } from '../../src/interfaces/job.interface';

jest.mock('../../src/services/transcription/transcribeStreamAudio.service');
jest.mock('../../src/services/auctionData/ingestStreamAuctionData.service');
jest.mock('../../src/services/lotReels/processStreamLots.service');

describe('processAuctionReelJobService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Stage 1: should call transcribeStreamAudioService and return immediately if transcript is not available', async () => {
    const job: AuctionReelJob = {
      stream_id: 12345,
      schema_version: 1,
      step: 'WAITING',
      status: 'ACTIVE',
      next_run_at: Date.now(),
      lease_until: null,
      worker_id: null,
      attempts: {},
      last_error: null,
      readiness: { auctions_closed: true, playlist_final: true, checked_at: '' },
      counts: { total: 0, prepared: 0, done: 0, needs_review: 0, failed: 0 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      transcript: undefined, // No transcript
    };

    (transcribeModule.transcribeStreamAudioService as jest.Mock).mockResolvedValue(undefined);

    await processAuctionReelJobService(job);

    expect(transcribeModule.transcribeStreamAudioService).toHaveBeenCalledWith(job);
    // Explicit requirement: on completion return from the function (don't call subsequent stages)
    expect(auctionDataModule.ingestStreamAuctionDataService).not.toHaveBeenCalled();
    expect(lotReelsModule.processStreamLotsService).not.toHaveBeenCalled();
  });

  it('Stage 2: should ingest auction data if transcript is available but auction data is missing', async () => {
    const job: AuctionReelJob = {
      stream_id: 12345,
      schema_version: 1,
      step: 'WAITING',
      status: 'ACTIVE',
      next_run_at: Date.now(),
      lease_until: null,
      worker_id: null,
      attempts: {},
      last_error: null,
      readiness: { auctions_closed: true, playlist_final: true, checked_at: '' },
      counts: { total: 0, prepared: 0, done: 0, needs_review: 0, failed: 0 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      transcript: {
        status: 'COMPLETED',
        storage_uri: 'gs://reels/transcripts/12345/transcript.json',
      },
      auction_data_present: false, // Auction data not yet present
    };

    (auctionDataModule.ingestStreamAuctionDataService as jest.Mock).mockResolvedValue(undefined);
    (lotReelsModule.processStreamLotsService as jest.Mock).mockResolvedValue(undefined);

    await processAuctionReelJobService(job);

    expect(transcribeModule.transcribeStreamAudioService).not.toHaveBeenCalled();
    expect(auctionDataModule.ingestStreamAuctionDataService).toHaveBeenCalledWith(job);
    expect(lotReelsModule.processStreamLotsService).toHaveBeenCalledWith(job);
  });

  it('Stage 3: should proceed directly to lot processing if both transcript and auction data are present', async () => {
    const job: AuctionReelJob = {
      stream_id: 12345,
      schema_version: 1,
      step: 'WAITING',
      status: 'ACTIVE',
      next_run_at: Date.now(),
      lease_until: null,
      worker_id: null,
      attempts: {},
      last_error: null,
      readiness: { auctions_closed: true, playlist_final: true, checked_at: '' },
      counts: { total: 0, prepared: 0, done: 0, needs_review: 0, failed: 0 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      transcript: {
        status: 'COMPLETED',
        storage_uri: 'gs://reels/transcripts/12345/transcript.json',
      },
      auction_data_present: true, // Both present
    };

    (lotReelsModule.processStreamLotsService as jest.Mock).mockResolvedValue(undefined);

    await processAuctionReelJobService(job);

    expect(transcribeModule.transcribeStreamAudioService).not.toHaveBeenCalled();
    expect(auctionDataModule.ingestStreamAuctionDataService).not.toHaveBeenCalled();
    expect(lotReelsModule.processStreamLotsService).toHaveBeenCalledWith(job);
  });
});
