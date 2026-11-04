import fs from 'fs';
import path from 'path';
import os from 'os';
import { cleanupStreamScratchService } from '../../src/services/media/cleanupStreamScratch.service';
import { env } from '../../src/config/env';

describe('cleanupStreamScratchService', () => {
  let originalScratch: string;
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-scratch-test-'));
    originalScratch = env.SCRATCH_DIR;
    env.SCRATCH_DIR = tempBaseDir;
  });

  afterEach(() => {
    env.SCRATCH_DIR = originalScratch;
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should remove existing stream scratch directory and return true', async () => {
    const streamScratch = path.join(tempBaseDir, '70277');
    const segsDir = path.join(streamScratch, 'segments');
    fs.mkdirSync(segsDir, { recursive: true });
    fs.writeFileSync(path.join(segsDir, 'seg_01.ts'), 'test-data');
    fs.writeFileSync(path.join(streamScratch, 'audio.mp3'), 'audio-data');

    expect(fs.existsSync(streamScratch)).toBe(true);

    const result = await cleanupStreamScratchService(70277);

    expect(result).toBe(true);
    expect(fs.existsSync(streamScratch)).toBe(false);
  });

  it('should return false if stream scratch directory does not exist', async () => {
    const result = await cleanupStreamScratchService(99999);
    expect(result).toBe(false);
  });

  it('should return false if streamId is invalid or empty', async () => {
    const result = await cleanupStreamScratchService(0 as any);
    expect(result).toBe(false);
  });
});
