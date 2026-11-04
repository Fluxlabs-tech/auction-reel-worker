import { runAuctionReelsCronTickService } from './runAuctionReelsCronTick.service';
import { env } from '../config/env';

let cronTimer: NodeJS.Timeout | null = null;
let isTickRunning = false;

export const startAuctionReelsCron = (intervalMs?: number): NodeJS.Timeout => {
  const scheduleInterval = intervalMs || env.CRON_INTERVAL_MS || 5 * 60 * 1000;

  if (cronTimer) {
    clearInterval(cronTimer);
  }

  console.log(
    `[startAuctionReelsCron] Starting 5-minute auction reels cron (interval: ${scheduleInterval}ms)...`,
  );

  cronTimer = setInterval(async () => {
    if (isTickRunning) {
      console.warn('[startAuctionReelsCron] Previous cron tick still active. Skipping this cycle.');
      return;
    }

    isTickRunning = true;
    try {
      await runAuctionReelsCronTickService();
    } catch (err: any) {
      console.error(
        '[startAuctionReelsCron] Unhandled error during cron tick:',
        err?.message || err,
      );
    } finally {
      isTickRunning = false;
    }
  }, scheduleInterval);

  return cronTimer;
};

export const stopAuctionReelsCron = (): void => {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    console.log('[startAuctionReelsCron] 5-minute cron stopped.');
  }
};
