import fs from 'fs';
import path from 'path';
import { env } from '../../config/env';

export const cleanupOrphanScratchService = async (
  maxAgeMs: number = 6 * 60 * 60 * 1000,
): Promise<number> => {
  let rootDir: string;
  let entries: string[];
  let purgedCount: number = 0;
  let now: number;
  let entryPath: string;
  let stat: fs.Stats;
  let ageMs: number;

  try {
    rootDir = env.SCRATCH_DIR;
    if (!fs.existsSync(rootDir)) {
      return 0;
    }

    entries = fs.readdirSync(rootDir);
    now = Date.now();

    for (let i = 0; i < entries.length; i++) {
      entryPath = path.join(rootDir, entries[i]);

      try {
        stat = fs.statSync(entryPath);
        if (!stat.isDirectory()) {
          continue;
        }

        ageMs = now - stat.mtimeMs;
        if (ageMs > maxAgeMs) {
          console.log(
            `[cleanupOrphanScratchService] Removing stale scratch folder ${entryPath} (age: ${(ageMs / 3600000).toFixed(1)}h)...`,
          );
          fs.rmSync(entryPath, { recursive: true, force: true });
          purgedCount++;
        }
      } catch (_entryErr: any) {
        console.warn(
          `[cleanupOrphanScratchService] Could not inspect/remove ${entryPath}:`,
          _entryErr?.message || _entryErr,
        );
      }
    }

    if (purgedCount > 0) {
      console.log(
        `[cleanupOrphanScratchService] Purged ${purgedCount} orphan scratch directory(ies).`,
      );
    }

    return purgedCount;
  } catch (error: any) {
    console.warn(
      '[cleanupOrphanScratchService] Error during scratch sweep:',
      error?.message || error,
    );
    return 0;
  }
};
