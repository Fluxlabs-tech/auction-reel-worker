import { ReelConfigModel } from '../../models/reelConfig.model';
import { ReelServerStateModel } from '../../models/reelServerState.model';
import { env } from '../../config/env';

export const runRefreshTickService = async (
  workerId: string,
  currentState?: { currentStreamId?: number | null; currentStep?: string | null },
): Promise<void> => {
  try {
    // 1. Reload reel_config/current
    await ReelConfigModel.getCurrentConfig();

    // 2. Write heartbeat
    await ReelServerStateModel.writeHeartbeat(workerId, {
      version: env.RENDERER_VERSION,
      streamId: currentState?.currentStreamId,
      step: currentState?.currentStep,
    });
  } catch (error: any) {
    console.error('[runRefreshTickService] Error running refresh tick:', error?.message || error, {
      workerId,
    });
  }
};
