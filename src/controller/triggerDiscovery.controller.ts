import { Request, Response } from 'express';
import { runDiscoveryTickService } from '../services/loops/runDiscoveryTick.service';

export const triggerDiscoveryController = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  let processedCount: number = 0;

  try {
    processedCount = await runDiscoveryTickService();

    return res.status(200).json({
      success: true,
      message: `Discovery completed. Found and enqueued ${processedCount} new stream job(s).`,
      processedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(
      '[triggerDiscoveryController] Error executing discovery cron trigger:',
      error?.message || error,
    );
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to execute discovery cron job',
    });
  }
};
