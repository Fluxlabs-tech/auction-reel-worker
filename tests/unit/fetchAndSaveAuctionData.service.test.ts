import { fetchAndSaveAuctionDataService } from '../../src/services/auctionData/fetchAndSaveAuctionData.service';
import { AuctionReelJobModel } from '../../src/models/auctionReelJob.model';
import { AuctionReelLotModel } from '../../src/models/auctionReelLot.model';
import * as getTimelineModule from '../../src/services/external/shareLeaderboard/getStreamAuctionTimeline.service';
import * as storage from '../../src/services/storage/uploadToStorage.service';
import * as enqueueLoop from '../../src/services/loops/enqueueStream.service';

jest.mock('../../src/services/external/shareLeaderboard/getStreamAuctionTimeline.service');
jest.mock('../../src/services/storage/uploadToStorage.service');
jest.mock('../../src/services/loops/enqueueStream.service');

describe('fetchAndSaveAuctionDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize job if not existing, fetch timeline, and persist to Firestore & storage', async () => {
    const streamId = 70316;
    const mockTimeline: getTimelineModule.StreamAuctionTimelineResponse = {
      stream_id: streamId,
      extension_window_ms: 10000,
      auctions: [
        {
          auction_id: 'auc-1',
          product_id: 101,
          status: 'settled',
          close_reason: 'timer',
          starting_price: 99,
          currency: 'INR',
          closing_rule_type: 'soft_close',
          closing_rule_config: { duration_seconds: 60 },
          started_at: '2026-11-03T10:00:00Z',
          ends_at: '2026-11-03T10:01:00Z',
          closed_at: '2026-11-03T10:01:00Z',
          extension_used_ms: 0,
          winner_count: 1,
          bids: [
            {
              submitted_at: '2026-11-03T10:00:30Z',
              amount: 150,
              bidder_display_name: 'Bidder1',
            },
          ],
          winner: {
            slot_rank: 1,
            winning_amount: 150,
            display_name: 'Bidder1',
          },
        },
      ],
    };

    jest.spyOn(AuctionReelJobModel, 'exists').mockResolvedValue(false);
    (enqueueLoop.enqueueStreamService as jest.Mock).mockResolvedValue({
      job: {} as any,
      alreadyExists: false,
    });
    (getTimelineModule.getStreamAuctionTimelineService as jest.Mock).mockResolvedValue(
      mockTimeline,
    );
    (storage.uploadToStorageService as jest.Mock).mockResolvedValue(
      'auction-reels/auctions/70316/auctions.json',
    );

    const saveJobSpy = jest
      .spyOn(AuctionReelJobModel, 'saveAuctionData')
      .mockResolvedValue(undefined as any);

    const existingLot = {
      id: 'auc-1',
      lot_number: 1,
      product_id: 101,
      status: 'COMPLETED' as const,
      artifacts: { reelUri: 'gs://bucket/reel.mp4' },
      attempts: { prepare: 1, render: 1 },
      created_at: '2026-11-03T09:00:00Z',
    };
    jest.spyOn(AuctionReelLotModel, 'listAll').mockResolvedValue([existingLot as any]);
    const createLotsSpy = jest
      .spyOn(AuctionReelLotModel, 'createMany')
      .mockResolvedValue(undefined as any);

    const result = await fetchAndSaveAuctionDataService(streamId);

    expect(enqueueLoop.enqueueStreamService).toHaveBeenCalledWith(streamId, false);
    expect(getTimelineModule.getStreamAuctionTimelineService).toHaveBeenCalledWith(streamId);
    expect(saveJobSpy).toHaveBeenCalledWith(
      streamId,
      expect.objectContaining({ 'auc-1': expect.any(Object) }),
      expect.arrayContaining([expect.objectContaining({ auction_id: 'auc-1' })]),
    );

    // Verify preservation of status & artifacts for existing lot
    expect(createLotsSpy).toHaveBeenCalledWith(
      streamId,
      expect.arrayContaining([
        expect.objectContaining({
          id: 'auc-1',
          status: 'COMPLETED',
          artifacts: { reelUri: 'gs://bucket/reel.mp4' },
        }),
      ]),
    );

    expect(storage.uploadToStorageService).toHaveBeenCalledWith(
      `auction-reels/auctions/${streamId}/auctions.json`,
      expect.any(String),
      expect.objectContaining({ contentType: 'application/json' }),
    );

    expect(result.stream_id).toBe(streamId);
    expect(result.total_lots).toBe(1);
    expect(result.bids_count).toBe(1);
  });
});
