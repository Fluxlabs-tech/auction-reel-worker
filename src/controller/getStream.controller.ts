import { Request, Response } from 'express';
import { AuctionReelJobModel } from '../models/auctionReelJob.model';
import { AuctionReelLotModel } from '../models/auctionReelLot.model';

export const getStreamController = async (req: Request, res: Response): Promise<Response> => {
  let streamId: number;
  let job: any;
  let lots: any[];

  try {
    streamId = parseInt(req.params.id, 10);
    if (isNaN(streamId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid stream_id parameter',
      });
    }

    job = await AuctionReelJobModel.get(streamId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: `Stream job ${streamId} not found`,
      });
    }

    lots = await AuctionReelLotModel.listAll(streamId);

    return res.status(200).json({
      success: true,
      data: {
        job,
        lots,
      },
    });
  } catch (error: any) {
    console.error('[getStreamController] Error fetching stream details:', error?.message || error, {
      params: req.params,
    });
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
};
