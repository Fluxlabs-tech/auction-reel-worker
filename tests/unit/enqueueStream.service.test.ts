import { enqueueStreamService } from '../../src/services/loops/enqueueStream.service';
import { AuctionReelJobModel } from '../../src/models/auctionReelJob.model';
import * as summaryService from '../../src/services/external/getStreamSummary.service';

describe('enqueueStreamService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return alreadyExists: true if job is already present', async () => {
    const existingJob = {
      stream_id: 12345,
      step: 'WAITING',
      status: 'ACTIVE',
    };

    jest.spyOn(AuctionReelJobModel, 'exists').mockResolvedValue(true);
    jest.spyOn(AuctionReelJobModel, 'get').mockResolvedValue(existingJob as any);

    const result = await enqueueStreamService(12345);

    expect(result.alreadyExists).toBe(true);
    expect(result.job).toEqual(existingJob);
  });

  it('should create new job with immediate execution when job does not exist', async () => {
    const mockSummary = {
      seller_id: 999,
      store_identifier: 'test-store',
    };
    const mockCreatedJob = {
      stream_id: 70278,
      seller_id: 999,
      store_id: 'test-store',
      step: 'WAITING',
      status: 'ACTIVE',
    };

    jest.spyOn(AuctionReelJobModel, 'exists').mockResolvedValue(false);
    jest.spyOn(summaryService, 'getStreamSummaryService').mockResolvedValue(mockSummary as any);
    const createSpy = jest
      .spyOn(AuctionReelJobModel, 'create')
      .mockResolvedValue(mockCreatedJob as any);

    const result = await enqueueStreamService(70278, true);

    expect(result.alreadyExists).toBe(false);
    expect(result.job).toEqual(mockCreatedJob);
    expect(createSpy).toHaveBeenCalledWith(
      70278,
      expect.objectContaining({
        seller_id: 999,
        store_id: 'test-store',
        step: 'WAITING',
        status: 'ACTIVE',
      }),
    );
  });

  it('should fallback to empty summary if getStreamSummaryService fails', async () => {
    const mockCreatedJob = {
      stream_id: 88888,
      step: 'WAITING',
      status: 'ACTIVE',
    };

    jest.spyOn(AuctionReelJobModel, 'exists').mockResolvedValue(false);
    jest
      .spyOn(summaryService, 'getStreamSummaryService')
      .mockRejectedValue(new Error('Summary API down'));
    const createSpy = jest
      .spyOn(AuctionReelJobModel, 'create')
      .mockResolvedValue(mockCreatedJob as any);

    const result = await enqueueStreamService(88888, false);

    expect(result.alreadyExists).toBe(false);
    expect(createSpy).toHaveBeenCalledWith(
      88888,
      expect.objectContaining({
        step: 'WAITING',
        status: 'ACTIVE',
      }),
    );
  });
});
