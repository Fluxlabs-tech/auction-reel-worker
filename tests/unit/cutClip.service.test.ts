import fs from 'fs';
import path from 'path';
import os from 'os';
import { cutClipService } from '../../src/services/media/cutClip.service';
import * as ensureModule from '../../src/services/media/ensureSegmentDownloaded.service';
import * as assertModule from '../../src/services/media/assertNonEmptyOutput.service';
import * as childProcess from 'child_process';
import { EventEmitter } from 'events';

jest.mock('../../src/services/media/ensureSegmentDownloaded.service');
jest.mock('../../src/services/media/assertNonEmptyOutput.service');
jest.mock('child_process');

describe('cutClipService', () => {
  let tempTargetDir: string;
  let tempSegmentsDir: string;
  let mockEnsure: jest.SpyInstance;
  let mockSpawn: jest.SpyInstance;

  beforeEach(() => {
    tempTargetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cut-clip-target-'));
    tempSegmentsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cut-clip-segs-'));

    mockEnsure = jest.spyOn(ensureModule, 'ensureSegmentDownloadedService');
    jest.spyOn(assertModule, 'assertNonEmptyOutputService').mockResolvedValue(undefined as any);

    mockSpawn = jest.spyOn(childProcess, 'spawn').mockImplementation(() => {
      const ee: any = new EventEmitter();
      ee.stderr = new EventEmitter();
      process.nextTick(() => {
        ee.emit('close', 0);
      });
      return ee;
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempTargetDir)) {
      fs.rmSync(tempTargetDir, { recursive: true, force: true });
    }
    if (fs.existsSync(tempSegmentsDir)) {
      fs.rmSync(tempSegmentsDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  it('should use ensureSegmentDownloadedService to resolve segments and write concat_list.txt', async () => {
    const fakeSeg1 = path.join(tempSegmentsDir, 'seg_01.ts');
    const fakeSeg2 = path.join(tempSegmentsDir, 'seg_02.ts');
    fs.writeFileSync(fakeSeg1, 'data1');
    fs.writeFileSync(fakeSeg2, 'data2');

    mockEnsure.mockResolvedValueOnce(fakeSeg1).mockResolvedValueOnce(fakeSeg2);

    const segs = [
      { key: 'streams/70277/seg_01.ts', dur: 2, media_start: 0, group: 0, pdt: null },
      { key: 'streams/70277/seg_02.ts', dur: 2, media_start: 2, group: 0, pdt: null },
      { key: 'streams/70277/seg_03.ts', dur: 2, media_start: 4, group: 0, pdt: null },
    ];

    const window = { m0: 0.5, m1: 3.5 };

    const clipPath = await cutClipService(segs, window, tempTargetDir, tempSegmentsDir);

    expect(clipPath).toBe(path.join(tempTargetDir, 'clip.mp4'));
    expect(mockEnsure).toHaveBeenCalledTimes(2);

    // Verify concat_list.txt was created and points to shared segmentsDir paths
    const concatListPath = path.join(tempTargetDir, 'concat_list.txt');
    expect(fs.existsSync(concatListPath)).toBe(true);
    const concatContent = fs.readFileSync(concatListPath, 'utf-8');
    expect(concatContent).toContain(`file '${fakeSeg1}'`);
    expect(concatContent).toContain(`file '${fakeSeg2}'`);

    // Verify ffmpeg was spawned with concat list
    expect(mockSpawn).toHaveBeenCalled();
    const spawnArgs = mockSpawn.mock.calls[0][1];
    expect(spawnArgs).toContain(concatListPath);
  });

  it('should throw error when no segments overlap the window', async () => {
    const segs = [{ key: 'streams/70277/seg_01.ts', dur: 2, media_start: 0, group: 0, pdt: null }];
    const window = { m0: 10, m1: 20 };

    await expect(cutClipService(segs, window, tempTargetDir, tempSegmentsDir)).rejects.toThrow(
      'No segments found for clip window',
    );
  });
});
