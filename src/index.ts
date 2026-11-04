import os from 'os';
import http from 'http';
import app from './app';
import { env } from './config/env';
import {
  startAuctionReelsCron,
  stopAuctionReelsCron,
  runAuctionReelsCronTickService,
  getRunningJobCount,
} from './cron';
import { AuctionReelJobModel } from './models/auctionReelJob.model';
import { cleanupOrphanScratchService } from './services/media/cleanupOrphanScratch.service';

const hostname = os.hostname();
const pid = process.pid;
const workerId = `${hostname}-${pid}`;

let isShuttingDown = false;
let server: http.Server | null = null;

const startServer = async () => {
  console.log(`[AuctionReelServer] Starting redesigned auction reels worker ${workerId}...`);
  console.log(`[AuctionReelServer] Configured STT provider: ${env.STT_PROVIDER}`);
  console.log(`[AuctionReelServer] Configured storage provider: ${env.STORAGE_PROVIDER}`);
  console.log(`[AuctionReelServer] Configured MAX_JOB_LIMIT: ${env.MAX_JOB_LIMIT}`);
  console.log(`[AuctionReelServer] Firestore collection: ${env.FIRESTORE_JOBS_COLLECTION}`);

  // 1. Start HTTP Server
  server = app.listen(env.PORT, () => {
    console.log(
      `[AuctionReelServer] Admin API listening on port ${env.PORT} (env: ${env.NODE_ENV})`,
    );
  });

  // 2. Sweep stale orphan scratch directories (>6h old)
  try {
    const swept = await cleanupOrphanScratchService();
    if (swept > 0) {
      console.log(`[AuctionReelServer] Cleaned up ${swept} stale scratch folder(s) on startup.`);
    }
  } catch (sweepErr: any) {
    console.warn(
      '[AuctionReelServer] Orphan scratch sweep warning:',
      sweepErr?.message || sweepErr,
    );
  }

  // 3. Start 5-Minute Cron Job
  startAuctionReelsCron(env.CRON_INTERVAL_MS);

  // 4. Immediate Initial Tick on Startup
  try {
    console.log('[AuctionReelServer] Executing initial startup tick...');
    const launched = await runAuctionReelsCronTickService(workerId);
    console.log(`[AuctionReelServer] Startup tick launched ${launched} job(s).`);
  } catch (initErr: any) {
    console.warn('[AuctionReelServer] Initial tick warning:', initErr?.message || initErr);
  }
};

const handleShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[AuctionReelServer] Received ${signal}. Initiating graceful shutdown...`);

  // Stop 5-minute cron
  stopAuctionReelsCron();

  // Wait for running jobs to finish (up to 60 seconds)
  const waitStart = Date.now();
  while (getRunningJobCount() > 0 && Date.now() - waitStart < 60000) {
    console.log(
      `[AuctionReelServer] Waiting for ${getRunningJobCount()} active job(s) to finish...`,
    );
    await new Promise((res) => setTimeout(res, 2000));
  }

  // Release any remaining leases claimed by this worker
  try {
    const released = await AuctionReelJobModel.releaseAllForWorker(workerId);
    console.log(`[AuctionReelServer] Released ${released} job lease(s) for worker ${workerId}.`);
  } catch (relErr: any) {
    console.error(
      '[AuctionReelServer] Error releasing leases on shutdown:',
      relErr?.message || relErr,
    );
  }

  if (server) {
    server.close(() => {
      console.log('[AuctionReelServer] HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer().catch((fatalErr) => {
  console.error('[AuctionReelServer] Fatal startup error:', fatalErr);
  process.exit(1);
});
