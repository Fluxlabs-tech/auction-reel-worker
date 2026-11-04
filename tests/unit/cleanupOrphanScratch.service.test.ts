import fs from 'fs';
import path from 'path';
import os from 'os';
import { cleanupOrphanScratchService } from '../../src/services/media/cleanupOrphanScratch.service';
import { env } from '../../src/config/env';

describe('cleanupOrphanScratchService', () => {
  let originalScratch: string;
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orphan-scratch-test-'));
    originalScratch = env.SCRATCH_DIR;
    env.SCRATCH_DIR = tempBaseDir;
  });

  afterEach(() => {
    env.SCRATCH_DIR = originalScratch;
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should remove directories older than maxAgeMs and preserve younger ones', async () => {
    const oldDir = path.join(tempBaseDir, '10001');
    const freshDir = path.join(tempBaseDir, '10002');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.mkdirSync(freshDir, { recursive: true });

    // Set oldDir mtime to 10 hours ago
    const tenHoursAgo = new Date(Date.now() - 10 * 3600 * 1000);
    fs.utimesSync(oldDir, tenHoursAgo, tenHoursAgo);

    // Max age 6 hours (6 * 3600 * 1000)
    const purged = await cleanupOrphanScratchService(6 * 3600 * 1000);

    expect(purged).toBe(1);
    expect(fs.existsSync(oldDir)).toBe(false);
    expect(fs.existsSync(freshDir)).toBe(true);
  });

  it('should ignore non-directory files', async () => {
    const regularFile = path.join(tempBaseDir, 'some_file.txt');
    fs.writeFileSync(regularFile, 'hello');

    const tenHoursAgo = new Date(Date.now() - 10 * 3600 * 1000);
    fs.utimesSync(regularFile, tenHoursAgo, tenHoursAgo);

    const purged = await cleanupOrphanScratchService(6 * 3600 * 1000);

    expect(purged).toBe(0);
    expect(fs.existsSync(regularFile)).toBe(true);
  });

  it('should return 0 when scratch directory does not exist', async () => {
    env.SCRATCH_DIR = path.join(tempBaseDir, 'non_existent_folder');
    const purged = await cleanupOrphanScratchService();
    expect(purged).toBe(0);
  });
});
