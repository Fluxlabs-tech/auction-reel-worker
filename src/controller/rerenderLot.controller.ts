import { Request, Response } from 'express';
import { AuctionReelJobModel } from '../models/auctionReelJob.model';
import { AuctionReelLotModel } from '../models/auctionReelLot.model';
import { ThemePin } from '../interfaces/job.interface';

export const rerenderLotController = async (req: Request, res: Response): Promise<Response> => {
  let streamId: number;
  let auctionId: string;
  let themeId: string | undefined;
  let themeVersion: number | undefined;
  let newThemePin: ThemePin | undefined;
  let lot: any;

  try {
    streamId = parseInt(req.body.stream_id, 10);
    auctionId = req.body.auction_id;
    themeId = req.body.theme_id;
    themeVersion = req.body.theme_version ? parseInt(req.body.theme_version, 10) : undefined;

    if (!streamId || isNaN(streamId) || !auctionId) {
      return res.status(400).json({
        success: false,
        error: 'Fields stream_id (number) and auction_id (string) are required',
      });
    }

    lot = await AuctionReelLotModel.get(streamId, auctionId);
    if (!lot) {
      return res.status(404).json({
        success: false,
        error: `Lot ${auctionId} not found under stream ${streamId}`,
      });
    }

    if (themeId) {
      newThemePin = {
        id: themeId,
        version: themeVersion || 1,
      };
    }

    // Reset lot to PREPARED with updated theme pin
    await AuctionReelLotModel.resetLotForRetry(streamId, auctionId, newThemePin);

    // Set stream job to RENDER_LOTS and ACTIVE
    await AuctionReelJobModel.resetForRetry(streamId, 'RENDER_LOTS');

    return res.status(200).json({
      success: true,
      message: `Lot ${auctionId} scheduled for rerender`,
      lotId: auctionId,
      streamId,
      pinnedTheme: newThemePin || lot.theme,
    });
  } catch (error: any) {
    console.error('[rerenderLotController] Error triggering rerender:', error?.message || error, {
      body: req.body,
    });
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
};
