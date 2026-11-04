import { Request, Response } from 'express';
import { ReelServerStateModel } from '../models/reelServerState.model';

export const getHealthController = async (req: Request, res: Response): Promise<Response> => {
  let heartbeat: any;
  let nowMs: number;
  let lastSeenMs: number;
  let isHealthy: boolean = true;
  let statusMessage: string = 'OK';

  try {
    heartbeat = await ReelServerStateModel.getHeartbeat();
    nowMs = Date.now();

    if (heartbeat && heartbeat.last_seen) {
      lastSeenMs = new Date(heartbeat.last_seen).getTime();
      // Check if heartbeat is older than 10 minutes (2x refresh interval)
      if (nowMs - lastSeenMs > 10 * 60 * 1000) {
        isHealthy = false;
        statusMessage = 'Heartbeat stale';
      }
    }

    return res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      message: statusMessage,
      timestamp: new Date(nowMs).toISOString(),
      heartbeat,
    });
  } catch (error: any) {
    console.error('[getHealthController] Error executing health check:', error?.message || error);
    return res.status(500).json({
      status: 'error',
      error: error?.message || 'Health check error',
    });
  }
};
