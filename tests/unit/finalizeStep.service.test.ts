import { finalizeStepService } from '../../src/services/steps/finalizeStep.service';
import { AuctionReelLotModel } from '../../src/models/auctionReelLot.model';
import * as cleanupModule from '../../src/services/media/cleanupStreamScratch.service';
import * as pubSubModule from '../../src/services/external/pubsub/publishAuctionReelEvent.service';
import { AuctionReelJob } from '../../src/interfaces/job.interface';

jest.mock('../../src/models/auctionReelLot.model');
jest.mock('../../src/services/media/cleanupStreamScratch.service');
jest.mock('../../src/services/external/pubsub/publishAuctionReelEvent.service');

describe('finalizeStepService', () => {
  const job: AuctionReelJob = {
    stream_id: 88888,
    schema_version: 1,
    step: 'FINALIZE',
    status: 'ACTIVE',
    next_run_at: Date.now(),
    lease_until: null,
    worker_id: null,
    attempts: {},
    last_error: null,
    readiness: { auctions_closed: true, playlist_final: true, checked_at: '' },
    counts: { total: 2, prepared: 0, done: 0, needs_review: 0, failed: 0 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (cleanupModule.cleanupStreamScratchService as jest.Mock).mockResolvedValue(true);
    (pubSubModule.publishAuctionReelEventService as jest.Mock).mockResolvedValue('msg-id-12345');
  });

  it('triggers stream-level DONE event without lot array when finalizing stream successfully', async () => {
    (AuctionReelLotModel.countsByStatus as jest.Mock).mockResolvedValue({
      total: 2,
      prepared: 0,
      done: 2,
      needs_review: 0,
      failed: 0,
    });

    const result = await finalizeStepService(job);

    expect(result.next).toBe('DONE');
    expect(result.patch.status).toBe('DONE');
    expect(pubSubModule.publishAuctionReelEventService).toHaveBeenCalledWith({
      status: 'DONE',
      stream_id: 88888,
      counts: {
        total: 2,
        prepared: 0,
        done: 2,
        needs_review: 0,
        failed: 0,
      },
      reason: undefined,
    });
  });

  it('triggers stream-level FAILED event if all lots failed', async () => {
    (AuctionReelLotModel.countsByStatus as jest.Mock).mockResolvedValue({
      total: 2,
      prepared: 0,
      done: 0,
      needs_review: 0,
      failed: 2,
    });

    const result = await finalizeStepService(job);

    expect(result.next).toBe('DONE');
    expect(result.patch.status).toBe('PARTIAL');
    expect(pubSubModule.publishAuctionReelEventService).toHaveBeenCalledWith({
      status: 'FAILED',
      stream_id: 88888,
      counts: {
        total: 2,
        prepared: 0,
        done: 0,
        needs_review: 0,
        failed: 2,
      },
      reason: undefined,
    });
  });

  it('triggers stream-level SKIPPED event if total lots is 0', async () => {
    (AuctionReelLotModel.countsByStatus as jest.Mock).mockResolvedValue({
      total: 0,
      prepared: 0,
      done: 0,
      needs_review: 0,
      failed: 0,
    });

    const result = await finalizeStepService(job);

    expect(result.next).toBe('DONE');
    expect(pubSubModule.publishAuctionReelEventService).toHaveBeenCalledWith({
      status: 'SKIPPED',
      stream_id: 88888,
      counts: {
        total: 0,
        prepared: 0,
        done: 0,
        needs_review: 0,
        failed: 0,
      },
      reason: 'no_auctions',
    });
  });
});
