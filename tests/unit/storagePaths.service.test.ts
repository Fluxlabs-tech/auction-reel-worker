import { uploadToStorageService } from '../../src/services/storage/uploadToStorage.service';
import { downloadFromStorageService } from '../../src/services/storage/downloadFromStorage.service';
import { uploadGcsObjectService } from '../../src/services/external/gcs/uploadGcsObject.service';
import { getStreamGcsPrefix, getLotGcsPrefix } from '../../src/services/steps/helpers';
import * as gcsClientModule from '../../src/services/external/gcs/gcsClient';
import * as s3ClientModule from '../../src/services/external/s3/s3Client';
import { env } from '../../src/config/env';

jest.mock('../../src/services/external/gcs/gcsClient');
jest.mock('../../src/services/external/s3/s3Client');

describe('Storage Folder Paths (No Bucket Name in Stored Path)', () => {
  let mockFileSave: jest.Mock;
  let mockFileDownload: jest.Mock;
  let mockBucket: jest.Mock;
  let mockGcs: any;

  let mockS3Send: jest.Mock;
  let mockS3: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFileSave = jest.fn().mockResolvedValue(undefined);
    mockFileDownload = jest.fn().mockResolvedValue([Buffer.from('{"test": true}')]);
    mockBucket = jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        save: mockFileSave,
        download: mockFileDownload,
      }),
    });
    mockGcs = { bucket: mockBucket };
    (gcsClientModule.getGcsClient as jest.Mock).mockReturnValue(mockGcs);

    mockS3Send = jest.fn().mockResolvedValue({
      Body: {
        on: (event: string, cb: any) => {
          if (event === 'data') cb(Buffer.from('s3 data'));
          if (event === 'end') cb();
        },
      },
    });
    mockS3 = { send: mockS3Send };
    (s3ClientModule.getS3Client as jest.Mock).mockReturnValue(mockS3);
  });

  describe('uploadToStorageService', () => {
    it('should return relative folder path without gs:// bucket name in GCP mode', async () => {
      env.STORAGE_PROVIDER = 'gcp';
      const key = 'auction-reels/reels/70277/01_abc/reel.mp4';
      const result = await uploadToStorageService(key, Buffer.from('dummy video'));

      expect(result).toBe('auction-reels/reels/70277/01_abc/reel.mp4');
      expect(result).not.toContain('gs://');
      expect(result).not.toContain(env.REELS_BUCKET);
      expect(mockGcs.bucket).toHaveBeenCalledWith(env.REELS_BUCKET);
    });

    it('should return relative folder path without s3:// bucket name in AWS mode', async () => {
      env.STORAGE_PROVIDER = 'aws';
      const key = 'auction-reels/reels/70277/01_abc/reel.mp4';
      const result = await uploadToStorageService(key, Buffer.from('dummy video'));

      expect(result).toBe('auction-reels/reels/70277/01_abc/reel.mp4');
      expect(result).not.toContain('s3://');
      expect(result).not.toContain(env.S3_BUCKET);
      expect(mockS3Send).toHaveBeenCalled();
      env.STORAGE_PROVIDER = 'gcp'; // reset
    });

    it('should strip leading slashes from key and return clean path', async () => {
      env.STORAGE_PROVIDER = 'gcp';
      const key = '/auction-reels/audio/70277/audio.mp3';
      const result = await uploadToStorageService(key, Buffer.from('audio bytes'));

      expect(result).toBe('auction-reels/audio/70277/audio.mp3');
    });
  });

  describe('downloadFromStorageService', () => {
    it('should download when provided a clean folder path', async () => {
      env.STORAGE_PROVIDER = 'gcp';
      const key = 'auction-reels/transcripts/70277/transcript.json';
      const buffer = await downloadFromStorageService(key);

      expect(buffer).toEqual(Buffer.from('{"test": true}'));
      expect(mockGcs.bucket).toHaveBeenCalledWith(env.REELS_BUCKET);
    });

    it('should maintain backward compatibility for legacy gs:// URIs', async () => {
      env.STORAGE_PROVIDER = 'gcp';
      const legacyUri = 'gs://legacy-bucket/auction-reels/transcripts/70277/transcript.json';
      const buffer = await downloadFromStorageService(legacyUri);

      expect(buffer).toEqual(Buffer.from('{"test": true}'));
      expect(mockGcs.bucket).toHaveBeenCalledWith('legacy-bucket');
    });

    it('should maintain backward compatibility for legacy s3:// URIs in AWS mode', async () => {
      env.STORAGE_PROVIDER = 'aws';
      const legacyUri = 's3://legacy-s3-bucket/auction-reels/transcripts/70277/transcript.json';
      const buffer = await downloadFromStorageService(legacyUri);

      expect(buffer).toEqual(Buffer.from('s3 data'));
      env.STORAGE_PROVIDER = 'gcp'; // reset
    });
  });

  describe('uploadGcsObjectService', () => {
    it('should return clean relative folder path without gs://', async () => {
      const path = 'auction-reels/2026-11-06/70277/clock.json';
      const result = await uploadGcsObjectService(path, { sample: 123 });

      expect(result).toBe('auction-reels/2026-11-06/70277/clock.json');
      expect(result).not.toContain('gs://');
      expect(result).not.toContain(env.REELS_BUCKET);
    });
  });

  describe('helpers getStreamGcsPrefix and getLotGcsPrefix', () => {
    it('should prefix all paths with auction-reels/ (with hyphen)', () => {
      const streamPrefix = getStreamGcsPrefix(70277, '2026-11-06T00:00:00Z');
      expect(streamPrefix).toBe('auction-reels/2026-11-06/70277/');
      expect(streamPrefix.startsWith('auction-reels/')).toBe(true);

      const lotPrefix = getLotGcsPrefix(70277, 1, 'auc-123', '2026-11-06T00:00:00Z');
      expect(lotPrefix).toBe('auction-reels/2026-11-06/70277/01_auc-123/');
      expect(lotPrefix.startsWith('auction-reels/')).toBe(true);
    });
  });
});
