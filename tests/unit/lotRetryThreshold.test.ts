import { processStreamLotsService } from '../../src/services/lotReels/processStreamLots.service';
import { AuctionReelLotModel } from '../../src/models/auctionReelLot.model';
import { AuctionReelJobModel } from '../../src/models/auctionReelJob.model';
import * as renderModule from '../../src/services/lotReels/renderSingleLotReel.service';
import * as storageModule from '../../src/services/storage/downloadFromStorage.service';
import * as s3Module from '../../src/services/external/s3/getS3Object.service';
import * as clockModule from '../../src/services/media/buildStreamClock.service';
import * as pubsubModule from '../../src/services/external/pubsub/publishAuctionReelEvent.service';
import { AuctionReelJob } from '../../src/interfaces/job.interface';
import { AuctionReelLot } from '../../src/interfaces/lot.interface';

jest.mock('../../src/models/auctionReelLot.model');
jest.mock('../../src/models/auctionReelJob.model');
jest.mock('../../src/services/lotReels/renderSingleLotReel.service');
jest.mock('../../src/services/storage/downloadFromStorage.service');
jest.mock('../../src/services/external/s3/getS3Object.service');
jest.mock('../../src/services/media/buildStreamClock.service');
jest.mock('../../src/services/external/pubsub/publishAuctionReelEvent.service');

describe('Lot 3-Retry Policy', () => {
  const job: AuctionReelJob = {
    stream_id: 99999,
    schema_version: 1,
    step: 'RENDER_LOTS',
    status: 'ACTIVE',
    next_run_at: Date.now(),
    lease_until: null,
    worker_id: null,
    attempts: {},
    last_error: null,
    readiness: { auctions_closed: true, playlist_final: true, checked_at: '' },
    counts: { total: 1, prepared: 0, done: 0, needs_review: 0, failed: 0 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (s3Module.getS3ObjectService as jest.Mock).mockResolvedValue(
      Buffer.from('#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6.0,\nseg1.ts\n#EXT-X-ENDLIST'),
    );
    (clockModule.buildStreamClockService as jest.Mock).mockResolvedValue({
      method: 'pdt',
      groups: [],
      toMedia: () => 10,
      toWall: () => new Date(),
    });
    (storageModule.downloadFromStorageService as jest.Mock).mockResolvedValue(
      Buffer.from(JSON.stringify([{ word: 'test', start: 0, end: 1 }])),
    );
  });

  it('should immediately mark lot FAILED if retry_count is already >= 3', async () => {
    const lotWith3Retries: AuctionReelLot = {
      id: 'auction-failed-threshold',
      lot_number: 1,
      product_id: 101,
      status: 'PENDING',
      retry_count: 3, // Already reached 3 retries
      attempts: { prepare: 0, render: 3 },
      last_error: 'Previous failure',
      theme: { id: 'default', version: 1 },
      summary: { started_at: '', closed_at: '', bid_count: 0 },
      flags: [],
      artifacts: {},
    };

    (AuctionReelLotModel.getUnprocessedLots as jest.Mock).mockResolvedValue([lotWith3Retries]);
    (AuctionReelLotModel.listAll as jest.Mock).mockResolvedValue([
      { ...lotWith3Retries, status: 'FAILED' },
    ]);

    await processStreamLotsService(job);

    expect(AuctionReelLotModel.markFailed).toHaveBeenCalledWith(
      99999,
      'auction-failed-threshold',
      'Exceeded maximum retries (3)',
    );
    expect(renderModule.renderSingleLotReelService).not.toHaveBeenCalled();
    expect(pubsubModule.publishAuctionReelEventService).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
        stream_id: 99999,
        counts: { total: 1, completed: 0, failed: 1 },
      }),
    );
  });

  it('should attempt render and increment retry count if retry_count < 3', async () => {
    const retryableLot: AuctionReelLot = {
      id: 'auction-retryable',
      lot_number: 1,
      product_id: 102,
      status: 'PENDING',
      retry_count: 1, // Only 1 attempt so far
      attempts: { prepare: 0, render: 1 },
      last_error: null,
      theme: { id: 'default', version: 1 },
      summary: { started_at: '', closed_at: '', bid_count: 0 },
      flags: [],
      artifacts: {},
    };

    (AuctionReelLotModel.getUnprocessedLots as jest.Mock).mockResolvedValue([retryableLot]);
    (AuctionReelLotModel.incrementRetry as jest.Mock).mockResolvedValue(2);
    (renderModule.renderSingleLotReelService as jest.Mock).mockResolvedValue({
      reelUri: 'gs://bucket/reels/reel.mp4',
      rawReelUri: 'gs://bucket/reels/raw_reel.mp4',
      thumbUri: 'gs://bucket/reels/thumb.jpg',
    });
    (AuctionReelLotModel.listAll as jest.Mock).mockResolvedValue([
      {
        ...retryableLot,
        status: 'COMPLETED',
        artifacts: {
          reelUri: 'gs://bucket/reels/reel.mp4',
          rawReelUri: 'gs://bucket/reels/raw_reel.mp4',
          thumbUri: 'gs://bucket/reels/thumb.jpg',
        },
      },
    ]);

    await processStreamLotsService(job);

    expect(AuctionReelLotModel.incrementRetry).toHaveBeenCalledWith(99999, 'auction-retryable');
    expect(renderModule.renderSingleLotReelService).toHaveBeenCalled();
    expect(AuctionReelLotModel.markCompleted).toHaveBeenCalledWith(
      99999,
      'auction-retryable',
      expect.objectContaining({ reelUri: 'gs://bucket/reels/reel.mp4' }),
    );
    expect(pubsubModule.publishAuctionReelEventService).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'DONE',
        stream_id: 99999,
        counts: { total: 1, completed: 1, failed: 0 },
      }),
    );
  });

  it('should not publish stream event if some lots are still pending or retryable', async () => {
    const lot1: AuctionReelLot = {
      id: 'auction-1',
      lot_number: 1,
      product_id: 101,
      status: 'PENDING',
      retry_count: 0,
      attempts: { prepare: 0, render: 0 },
      last_error: null,
      theme: { id: 'default', version: 1 },
      summary: { started_at: '', closed_at: '', bid_count: 0 },
      flags: [],
      artifacts: {},
    };
    const lot2: AuctionReelLot = {
      id: 'auction-2',
      lot_number: 2,
      product_id: 102,
      status: 'PENDING',
      retry_count: 0,
      attempts: { prepare: 0, render: 0 },
      last_error: null,
      theme: { id: 'default', version: 1 },
      summary: { started_at: '', closed_at: '', bid_count: 0 },
      flags: [],
      artifacts: {},
    };

    (AuctionReelLotModel.getUnprocessedLots as jest.Mock).mockResolvedValue([lot1]);
    (AuctionReelLotModel.incrementRetry as jest.Mock).mockResolvedValue(1);
    (renderModule.renderSingleLotReelService as jest.Mock).mockResolvedValue({
      reelUri: 'gs://bucket/reels/reel1.mp4',
    });
    (AuctionReelLotModel.listAll as jest.Mock).mockResolvedValue([
      { ...lot1, status: 'COMPLETED' },
      lot2,
    ]);

    await processStreamLotsService(job);

    expect(AuctionReelJobModel.markCompleted).not.toHaveBeenCalled();
    expect(pubsubModule.publishAuctionReelEventService).not.toHaveBeenCalled();
  });

  it('should mark job SKIPPED when stream has zero lots', async () => {
    (AuctionReelLotModel.getUnprocessedLots as jest.Mock).mockResolvedValue([]);
    (AuctionReelLotModel.listAll as jest.Mock).mockResolvedValue([]);

    await processStreamLotsService(job);

    expect(AuctionReelJobModel.markSkipped).toHaveBeenCalledWith(99999, 'no_auctions');
    expect(AuctionReelJobModel.markCompleted).not.toHaveBeenCalled();
    expect(pubsubModule.publishAuctionReelEventService).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SKIPPED',
        stream_id: 99999,
        reason: 'no_auctions',
      }),
    );
  });

  it('should mark job COMPLETED when all lots have already been processed', async () => {
    (AuctionReelLotModel.getUnprocessedLots as jest.Mock).mockResolvedValue([]);
    (AuctionReelLotModel.listAll as jest.Mock).mockResolvedValue([
      { id: 'lot-1', status: 'COMPLETED' },
    ]);

    await processStreamLotsService(job);

    expect(AuctionReelJobModel.markCompleted).toHaveBeenCalledWith(99999);
    expect(AuctionReelJobModel.markSkipped).not.toHaveBeenCalled();
  });
});
