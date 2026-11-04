import fs from 'fs';
import path from 'path';
import os from 'os';
import { ensureSegmentDownloadedService } from '../../src/services/media/ensureSegmentDownloaded.service';
import * as s3Module from '../../src/services/external/s3/getS3Object.service';

jest.mock('../../src/services/external/s3/getS3Object.service');

describe('ensureSegmentDownloadedService', () => {
  let tempDir: string;
  let mockGetS3Object: jest.SpyInstance;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-seg-test-'));
    mockGetS3Object = jest.spyOn(s3Module, 'getS3ObjectService');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  it('should return existing file path on cache hit without calling S3', async () => {
    const existingFile = path.join(tempDir, 'segment_001.ts');
    fs.writeFileSync(existingFile, Buffer.from('existing-ts-data'));

    const result = await ensureSegmentDownloadedService({
      streamId: 70277,
      segKey: 'streams/70277/segment_001.ts',
      segmentsDir: tempDir,
    });

    expect(result).toBe(existingFile);
    expect(mockGetS3Object).not.toHaveBeenCalled();
  });

  it('should download and write segment to disk on cache miss', async () => {
    const mockBuffer = Buffer.from('downloaded-segment-bytes');
    mockGetS3Object.mockResolvedValueOnce(mockBuffer);

    const result = await ensureSegmentDownloadedService({
      streamId: 70277,
      segKey: 'segment_002.ts',
      segmentsDir: tempDir,
    });

    expect(result).toBe(path.join(tempDir, 'segment_002.ts'));
    expect(mockGetS3Object).toHaveBeenCalledWith('streams/70277/segment_002.ts');
    expect(fs.existsSync(result)).toBe(true);
    expect(fs.readFileSync(result).toString()).toBe('downloaded-segment-bytes');
  });

  it('should strip query params when resolving segment filename', async () => {
    const mockBuffer = Buffer.from('ts-with-query');
    mockGetS3Object.mockResolvedValueOnce(mockBuffer);

    const result = await ensureSegmentDownloadedService({
      streamId: 70277,
      segKey: 'streams/70277/segment_003.ts?expires=12345&sig=abc',
      segmentsDir: tempDir,
    });

    expect(result).toBe(path.join(tempDir, 'segment_003.ts'));
    expect(mockGetS3Object).toHaveBeenCalledWith(
      'streams/70277/segment_003.ts?expires=12345&sig=abc',
    );
    expect(fs.existsSync(result)).toBe(true);
  });

  it('should throw error when S3 returns an empty buffer', async () => {
    mockGetS3Object.mockResolvedValueOnce(Buffer.alloc(0));

    await expect(
      ensureSegmentDownloadedService({
        streamId: 70277,
        segKey: 'empty.ts',
        segmentsDir: tempDir,
      }),
    ).rejects.toThrow('Empty segment buffer received');
  });

  it('should throw error when segKey or segmentsDir is missing', async () => {
    await expect(
      ensureSegmentDownloadedService({
        streamId: 70277,
        segKey: '',
        segmentsDir: tempDir,
      }),
    ).rejects.toThrow('Invalid arguments');
  });
});
