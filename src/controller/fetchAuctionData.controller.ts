import { Request, Response } from 'express';
import {
  fetchAndSaveAuctionDataService,
  IngestAuctionDataResult,
} from '../services/auctionData/fetchAndSaveAuctionData.service';
import { StreamAuctionTimelineResponse } from '../services/external/shareLeaderboard';

export const fetchAuctionDataController = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  let rawStreamId: any;
  let streamId: number;
  let providedTimeline: StreamAuctionTimelineResponse | undefined;
  let result: IngestAuctionDataResult;

  try {
    rawStreamId =
      req.body?.stream_id ??
      req.body?.streamId ??
      req.params?.id ??
      req.params?.streamId ??
      req.query?.stream_id ??
      req.query?.streamId;

    streamId = parseInt(rawStreamId, 10);
    if (!streamId || isNaN(streamId)) {
      return res.status(400).json({
        success: false,
        error: 'Field stream_id (number) is required in request body, route params, or query',
      });
    }

    if (req.body?.timeline && Array.isArray(req.body?.timeline?.auctions)) {
      providedTimeline = req.body.timeline;
    } else if (Array.isArray(req.body?.auctions)) {
      providedTimeline = {
        stream_id: streamId,
        extension_window_ms: req.body?.extension_window_ms || 10000,
        auctions: req.body.auctions,
      };
    }

    result = await fetchAndSaveAuctionDataService(streamId, providedTimeline);

    return res.status(200).json({
      success: true,
      message: `Auction data successfully fetched and updated in Firestore for stream ${streamId}`,
      data: result,
    });
  } catch (error: any) {
    console.error(
      '[fetchAuctionDataController] Error fetching auction data:',
      error?.message || error,
      {
        body: req.body,
        params: req.params,
        query: req.query,
      },
    );
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
};
