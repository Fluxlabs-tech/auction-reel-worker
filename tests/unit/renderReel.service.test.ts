import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import * as childProcess from 'child_process';
import { renderReelService } from '../../src/services/render/renderReel.service';
import * as assertModule from '../../src/services/media/assertNonEmptyOutput.service';
import { ReelTimeline } from '../../src/interfaces/timeline.interface';
import { ReelThemeVersion } from '../../src/interfaces/theme.interface';
import { DEFAULT_THEME_VERSION } from '../../src/config/defaults';

jest.mock('../../src/services/media/assertNonEmptyOutput.service');
jest.mock('child_process');

describe('renderReelService', () => {
  let tempOutDir: string;
  let fakeClipPath: string;
  let mockTimeline: ReelTimeline;
  let mockTheme: ReelThemeVersion;

  beforeEach(() => {
    tempOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-reel-test-'));
    fakeClipPath = path.join(tempOutDir, 'input_clip.mp4');
    fs.writeFileSync(fakeClipPath, 'fake video input');

    mockTimeline = {
      version: 1,
      meta: {
        stream_id: 70277,
        auction_id: 'auc_1',
        lot_no: 1,
        lot_total: 1,
        store: 'Test Store',
        starting_price: 100,
        currency: 'INR',
        latency_s: 2.0,
      },
      intro: { t0: 0, t1: 2 },
      live: { t: 2 },
      bids: [],
      deadline: { ok: true, segments: [] },
      close: { t: 40 },
      result: { kind: 'sold', t: 45, amount: 1500, winner: 'Buyer1' },
      cues: [],
      captions: [],
      end: 50.0,
    };

    mockTheme = {
      ...DEFAULT_THEME_VERSION,
      basePath: tempOutDir,
    };

    jest.spyOn(assertModule, 'assertNonEmptyOutputService').mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    if (fs.existsSync(tempOutDir)) {
      fs.rmSync(tempOutDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  it('should assemble ffmpeg arguments with dynamic VBV budget and generate reel and thumbnail', async () => {
    const spawnedCommands: Array<{ cmd: string; args: string[] }> = [];

    jest.spyOn(childProcess, 'spawn').mockImplementation((...callArgs: any[]) => {
      const cmd = String(callArgs[0]);
      const args: string[] = (callArgs[1] || []).map(String);
      spawnedCommands.push({ cmd, args });
      const ee: any = new EventEmitter();
      ee.stderr = new EventEmitter();

      // If rendering reel, simulate creating reel.mp4 of normal size (e.g. 12 MB)
      if (args.includes(path.join(tempOutDir, 'reel.mp4'))) {
        const reelFile = path.join(tempOutDir, 'reel.mp4');
        fs.writeFileSync(reelFile, Buffer.alloc(12 * 1024 * 1024)); // 12 MB
      }

      process.nextTick(() => {
        ee.emit('close', 0);
      });
      return ee;
    });

    const result = await renderReelService(fakeClipPath, mockTimeline, mockTheme, tempOutDir);

    expect(result.reelPath).toBe(path.join(tempOutDir, 'reel.mp4'));
    expect(result.thumbPath).toBe(path.join(tempOutDir, 'thumb.jpg'));
    expect(fs.existsSync(result.hudAssPath)).toBe(true);
    expect(fs.existsSync(result.captionsAssPath)).toBe(true);

    // Verify main ffmpeg command had VBV arguments
    const renderCall = spawnedCommands.find((c) => c.args.includes(result.reelPath));
    expect(renderCall).toBeDefined();
    expect(renderCall?.args).toContain('-maxrate');
    expect(renderCall?.args).toContain('-bufsize');
    expect(renderCall?.args).toContain('-crf');
    expect(renderCall?.args).toContain('23');

    // For 50s: 15MB = 125,829,120 bits. 125829120 / 50 = 2,516,582 bps. Minus 128k = 2388 kbps.
    const maxrateIndex = renderCall!.args.indexOf('-maxrate');
    expect(renderCall!.args[maxrateIndex + 1]).toBe('2388k');

    // Thumbnail generation called
    const thumbCall = spawnedCommands.find((c) => c.args.includes(result.thumbPath));
    expect(thumbCall).toBeDefined();
  });

  it('should trigger failsafe recode pass when reel size exceeds 16MB', async () => {
    const spawnedCommands: Array<{ cmd: string; args: string[] }> = [];

    jest.spyOn(childProcess, 'spawn').mockImplementation((...callArgs: any[]) => {
      const cmd = String(callArgs[0]);
      const args: string[] = (callArgs[1] || []).map(String);
      spawnedCommands.push({ cmd, args });
      const ee: any = new EventEmitter();
      ee.stderr = new EventEmitter();

      const outputFile = args[args.length - 1] || '';
      if (outputFile.endsWith('reel_recode.mp4')) {
        // Failsafe pass: simulate recoded file (e.g. 13 MB)
        fs.writeFileSync(path.join(tempOutDir, 'reel_recode.mp4'), Buffer.alloc(13 * 1024 * 1024));
      } else if (outputFile.endsWith('reel.mp4')) {
        // First pass: simulate oversized reel (e.g. 17 MB)
        fs.writeFileSync(path.join(tempOutDir, 'reel.mp4'), Buffer.alloc(17 * 1024 * 1024));
      } else if (outputFile.endsWith('thumb.jpg')) {
        fs.writeFileSync(path.join(tempOutDir, 'thumb.jpg'), Buffer.alloc(1024));
      }

      process.nextTick(() => {
        ee.emit('close', 0);
      });
      return ee;
    });

    const result = await renderReelService(fakeClipPath, mockTimeline, mockTheme, tempOutDir);

    // Assert that recode pass was invoked with CBR safety rate and reel_recode.mp4
    const recodeCall = spawnedCommands.find((c) =>
      c.args.some((a) => a.includes('reel_recode.mp4')),
    );
    expect(recodeCall).toBeDefined();
    expect(recodeCall?.args).toContain('-b:v');
    expect(recodeCall?.args).toContain('-c:a');
    expect(recodeCall?.args).toContain('copy');

    // The recode file was renamed to replace reel.mp4
    const finalSize = fs.statSync(result.reelPath).size;
    expect(finalSize).toBe(13 * 1024 * 1024);
  });
});
