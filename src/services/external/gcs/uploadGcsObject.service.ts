import { getGcsClient } from './gcsClient';
import { env } from '../../../config/env';

export const uploadGcsObjectService = async (
  targetPathOrUri: string,
  content: string | Buffer | object,
  contentType?: string,
): Promise<string> => {
  let gcs: any;
  let bucketName: string;
  let filePath: string;
  let payloadBuffer: Buffer;
  let detectedContentType: string;
  let bucket: any;
  let file: any;

  try {
    gcs = getGcsClient();

    if (targetPathOrUri.startsWith('gs://')) {
      const parts = targetPathOrUri.replace('gs://', '').split('/');
      bucketName = parts[0];
      filePath = parts.slice(1).join('/');
    } else {
      bucketName = env.REELS_BUCKET;
      filePath = targetPathOrUri.startsWith('/') ? targetPathOrUri.slice(1) : targetPathOrUri;
    }

    if (Buffer.isBuffer(content)) {
      payloadBuffer = content;
      detectedContentType = contentType || 'application/octet-stream';
    } else if (typeof content === 'string') {
      payloadBuffer = Buffer.from(content, 'utf-8');
      detectedContentType = contentType || 'text/plain';
    } else {
      payloadBuffer = Buffer.from(JSON.stringify(content, null, 2), 'utf-8');
      detectedContentType = contentType || 'application/json';
    }

    bucket = gcs.bucket(bucketName);
    file = bucket.file(filePath);

    await file.save(payloadBuffer, {
      contentType: detectedContentType,
      resumable: false,
    });

    return filePath;
  } catch (error: any) {
    console.error('[uploadGcsObjectService] Error uploading to GCS:', error?.message || error, {
      targetPathOrUri,
    });
    throw error;
  }
};
