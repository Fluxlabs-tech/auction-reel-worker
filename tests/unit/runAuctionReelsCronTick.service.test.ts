import {
  runAuctionReelsCronTickService,
  setRunningJobCount,
} from '../../src/cron/runAuctionReelsCronTick.service';
import { AuctionReelJobModel } from '../../src/models/auctionReelJob.model';
import * as pipelineModule from '../../src/services/pipeline/processAuctionReelJob.service';
import { env } from '../../src/config/env';

jest.mock('../../src/models/auctionReelJob.model');
jest.mock('../../src/services/pipeline/processAuctionReelJob.service');

describe('runAuctionReelsCronTickService', () => {
  const originalMaxLimit = env.MAX_JOB_LIMIT;

  beforeEach(() => {
    jest.clearAllMocks();
    setRunningJobCount(0);
    env.MAX_JOB_LIMIT = 2;
  });

  afterAll(() => {
    env.MAX_JOB_LIMIT = originalMaxLimit;
  });

  it('should skip tick when active running jobs >= MAX_JOB_LIMIT', async () => {
    setRunningJobCount(2);

    const launched = await runAuctionReelsCronTickService('test-worker');

    expect(launched).toBe(0);
    expect(AuctionReelJobModel.findActiveJobs).not.toHaveBeenCalled();
  });

  it('should query Firestore with available capacity when running jobs < MAX_JOB_LIMIT', async () => {
    setRunningJobCount(1);
    (AuctionReelJobModel.findActiveJobs as jest.Mock).mockResolvedValue([]);

    const launched = await runAuctionReelsCronTickService('test-worker');

    expect(launched).toBe(0);
    expect(AuctionReelJobModel.findActiveJobs).toHaveBeenCalledWith(1); // 2 - 1 = 1 slot
  });

  it('should claim and launch jobs up to available capacity', async () => {
    setRunningJobCount(0);
    const mockJobs = [
      { stream_id: 101, status: 'PENDING' },
      { stream_id: 102, status: 'PENDING' },
    ];
    (AuctionReelJobModel.findActiveJobs as jest.Mock).mockResolvedValue(mockJobs);
    (AuctionReelJobModel.claimJob as jest.Mock).mockImplementation((streamId) =>
      Promise.resolve({ stream_id: streamId, status: 'PROCESSING' }),
    );
    (pipelineModule.processAuctionReelJobService as jest.Mock).mockResolvedValue(undefined);

    const launched = await runAuctionReelsCronTickService('test-worker');

    expect(launched).toBe(2);
    expect(AuctionReelJobModel.claimJob).toHaveBeenCalledTimes(2);
    expect(pipelineModule.processAuctionReelJobService).toHaveBeenCalledTimes(2);
  });
});
