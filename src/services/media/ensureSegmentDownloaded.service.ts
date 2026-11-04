import fs from 'fs';
import path from 'path';
import { getS3ObjectService } from '../external/s3/getS3Object.service';

export interface EnsureSegmentDownloadedOptions {
  streamId?: number;
  segKey: string;
  segmentsDir: string;
}

export const ensureSegmentDownloadedService = async (
  options: EnsureSegmentDownloadedOptions,
): Promise<string> => {
  let segFilename: string;
  let targetPath: string;
  let tempPath: string;
  let s3Key: string;
  let buffer: Buffer;

  try {
    const { streamId, segKey, segmentsDir } = options;

    if (!segmentsDir || !segKey) {
      throw new Error(
        `Invalid arguments to ensureSegmentDownloadedService: segKey="${segKey}", segmentsDir="${segmentsDir}"`,
      );
    }

    if (!fs.existsSync(segmentsDir)) {
      fs.mkdirSync(segmentsDir, { recursive: true });
    }

    // Extract canonical filename from key, stripping any query string
    segFilename = path.basename(segKey.split('?')[0]);
    targetPath = path.join(segmentsDir, segFilename);

    // Fast-path: return cached segment if already on disk and non-empty
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
      return targetPath;
    }

    s3Key = segKey.startsWith('streams/')
      ? segKey
      : streamId
        ? `streams/${streamId}/${segKey}`
        : segKey;

    buffer = await getS3ObjectService(s3Key);

    if (!buffer || buffer.length === 0) {
      throw new Error(`Empty segment buffer received for key: ${s3Key}`);
    }

    // Atomic write to avoid partial reads under parallel lot rendering
    tempPath = `${targetPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(tempPath, buffer);

    try {
      fs.renameSync(tempPath, targetPath);
    } catch (_renameErr: any) {
      // If another parallel lot finished writing and renamed first, clean up temp file
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (_unlinkErr: any) {
          // ignore cleanup errors
        }
      }
    }

    return targetPath;
  } catch (error: any) {
    console.error('[ensureSegmentDownloadedService] Error downloading segment:', {
      error: error?.message || error,
      options,
    });
    throw error;
  }
};
