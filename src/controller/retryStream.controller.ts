import { Request, Response } from 'express';
import { AuctionReelJobModel } from '../models/auctionReelJob.model';
import { AuctionReelLotModel } from '../models/auctionReelLot.model';
import { JobStep } from '../interfaces/job.interface';

export const retryStreamController = async (req: Request, res: Response): Promise<Response> => {
  let streamId: number;
  let targetStep: JobStep | undefined;
  let job: any;
  let failedLots: any[];

  try {
    streamId = parseInt(req.body.stream_id, 10);
    targetStep = req.body.step as JobStep | undefined;

    if (!streamId || isNaN(streamId)) {
      return res.status(400).json({
        success: false,
        error: 'Field stream_id (number) is required in request body',
      });
    }

    job = await AuctionReelJobModel.get(streamId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: `Stream job ${streamId} not found`,
      });
    }

    // Reset failed lots back to PREPARED or PENDING
    failedLots = await AuctionReelLotModel.listByStatus(streamId, ['FAILED']);
    for (const lot of failedLots) {
      await AuctionReelLotModel.resetLotForRetry(streamId, lot.id);
    }

    // Reset job
    await AuctionReelJobModel.resetForRetry(streamId, targetStep);

    return res.status(200).json({
      success: true,
      message: `Stream ${streamId} reset for retry (step: ${targetStep || job.step})`,
      resetLotsCount: failedLots.length,
    });
  } catch (error: any) {
    console.error('[retryStreamController] Error retrying stream:', error?.message || error, {
      body: req.body,
    });
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
};
