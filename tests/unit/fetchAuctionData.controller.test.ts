import { Request, Response } from 'express';
import { fetchAuctionDataController } from '../../src/controller/fetchAuctionData.controller';
import * as fetchAndSaveService from '../../src/services/auctionData/fetchAndSaveAuctionData.service';

describe('fetchAuctionDataController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockReq = {
      body: {},
      params: {},
      query: {},
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    jest.clearAllMocks();
  });

  it('should return 400 when stream_id is missing', async () => {
    mockReq.body = {};

    await fetchAuctionDataController(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Field stream_id (number) is required'),
      }),
    );
  });

  it('should return 400 when stream_id is not a valid number', async () => {
    mockReq.body = { stream_id: 'invalid-id' };

    await fetchAuctionDataController(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('should return 200 and data when stream_id is provided in body', async () => {
    mockReq.body = { stream_id: 70316 };
    const mockResult: fetchAndSaveService.IngestAuctionDataResult = {
      stream_id: 70316,
      total_lots: 41,
      bids_count: 120,
      auctions_count: 41,
      storage_uri: 'auction-reels/auctions/70316/auctions.json',
      updated_at: '2026-11-03T16:00:00.000Z',
      auctions: {},
    };

    jest.spyOn(fetchAndSaveService, 'fetchAndSaveAuctionDataService').mockResolvedValue(mockResult);

    await fetchAuctionDataController(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      message: 'Auction data successfully fetched and updated in Firestore for stream 70316',
      data: mockResult,
    });
  });

  it('should return 200 when stream_id is provided in params or query', async () => {
    mockReq.params = { id: '70316' };
    const mockResult: fetchAndSaveService.IngestAuctionDataResult = {
      stream_id: 70316,
      total_lots: 10,
      bids_count: 50,
      auctions_count: 10,
      storage_uri: 'auction-reels/auctions/70316/auctions.json',
      updated_at: '2026-11-03T16:00:00.000Z',
      auctions: {},
    };

    jest.spyOn(fetchAndSaveService, 'fetchAndSaveAuctionDataService').mockResolvedValue(mockResult);

    await fetchAuctionDataController(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(fetchAndSaveService.fetchAndSaveAuctionDataService).toHaveBeenCalledWith(
      70316,
      undefined,
    );
  });

  it('should pass provided auctions in body to service', async () => {
    mockReq.body = { stream_id: 70316, auctions: [{ auction_id: 'auc-1' }] };
    const mockResult: fetchAndSaveService.IngestAuctionDataResult = {
      stream_id: 70316,
      total_lots: 1,
      bids_count: 0,
      auctions_count: 1,
      storage_uri: 'auction-reels/auctions/70316/auctions.json',
      updated_at: '2026-11-03T16:00:00.000Z',
      auctions: {},
    };

    jest.spyOn(fetchAndSaveService, 'fetchAndSaveAuctionDataService').mockResolvedValue(mockResult);

    await fetchAuctionDataController(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(fetchAndSaveService.fetchAndSaveAuctionDataService).toHaveBeenCalledWith(70316, {
      stream_id: 70316,
      extension_window_ms: 10000,
      auctions: [{ auction_id: 'auc-1' }],
    });
  });

  it('should return 500 when service throws an error', async () => {
    mockReq.body = { stream_id: 70316 };
    jest
      .spyOn(fetchAndSaveService, 'fetchAndSaveAuctionDataService')
      .mockRejectedValue(new Error('Timeline network timeout'));

    await fetchAuctionDataController(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Timeline network timeout',
      }),
    );
  });
});
