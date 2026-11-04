import fs from 'fs';
import path from 'path';
import { env } from '../../config/env';

export const cleanupStreamScratchService = async (streamId: number | string): Promise<boolean> => {
  let scratchDir: string;
  let exists: boolean;

  try {
    if (!streamId) {
      console.warn('[cleanupStreamScratchService] Called without valid streamId, skipping.');
      return false;
    }

    scratchDir = path.join(env.SCRATCH_DIR, String(streamId));
    exists = fs.existsSync(scratchDir);

    if (!exists) {
      return false;
    }

    console.log(
      `[cleanupStreamScratchService] Purging scratch directory for stream ${streamId} (${scratchDir})...`,
    );
    fs.rmSync(scratchDir, { recursive: true, force: true });
    console.log(
      `[cleanupStreamScratchService] Successfully cleaned up scratch directory for stream ${streamId}`,
    );
    return true;
  } catch (error: any) {
    console.warn(
      `[cleanupStreamScratchService] Scratch cleanup warning for stream ${streamId}:`,
      error?.message || error,
    );
    return false;
  }
};
