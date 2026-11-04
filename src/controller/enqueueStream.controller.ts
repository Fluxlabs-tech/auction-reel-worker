import { Request, Response } from 'express';
import { enqueueStreamService } from '../services/loops/enqueueStream.service';

export const enqueueStreamController = async (req: Request, res: Response): Promise<Response> => {
  let streamId: number;
  let result: any;

  try {
    streamId = parseInt(req.body.stream_id, 10);
    if (!streamId || isNaN(streamId)) {
      return res.status(400).json({
        success: false,
        error: 'Field stream_id (number) is required in request body',
      });
    }

    result = await enqueueStreamService(streamId, true);
    if (result.alreadyExists) {
      return res.status(409).json({
        success: false,
        message: `Job for stream ${streamId} already exists`,
      });
    }

    return res.status(201).json({
      success: true,
      message: `Stream ${streamId} enqueued successfully`,
      data: result.job,
    });
  } catch (error: any) {
    console.error('[enqueueStreamController] Error enqueuing stream:', error?.message || error, {
      body: req.body,
    });
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
};
