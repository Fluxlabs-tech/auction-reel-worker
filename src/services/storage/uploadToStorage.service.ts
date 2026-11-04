import fs from 'fs';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env';
import { getGcsClient } from '../external/gcs/gcsClient';
import { getS3Client } from '../external/s3/s3Client';

export interface UploadOptions {
  bucket?: string;
  contentType?: string;
}

export const uploadToStorageService = async (
  key: string,
  content: Buffer | string,
  options?: UploadOptions,
): Promise<string> => {
  let targetBucket: string;
  let mimeType: string;
  let fileBuffer: Buffer;
  let gcsClient: any;
  let bucketRef: any;
  let fileRef: any;
  let s3Client: any;
  let s3Command: any;

  try {
    targetBucket =
      options?.bucket || (env.STORAGE_PROVIDER === 'aws' ? env.S3_BUCKET : env.REELS_BUCKET);
    mimeType = options?.contentType || 'application/octet-stream';

    // If string is passed and it points to an existing local file, read buffer
    if (typeof content === 'string' && fs.existsSync(content)) {
      fileBuffer = fs.readFileSync(content);
    } else if (typeof content === 'string') {
      fileBuffer = Buffer.from(content, 'utf-8');
    } else {
      fileBuffer = content;
    }

    if (env.STORAGE_PROVIDER === 'aws') {
      s3Client = getS3Client();
      s3Command = new PutObjectCommand({
        Bucket: targetBucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      });
      await s3Client.send(s3Command);
      return `s3://${targetBucket}/${key}`;
    }

    // Default: GCP Cloud Storage
    gcsClient = getGcsClient();
    bucketRef = gcsClient.bucket(targetBucket);
    fileRef = bucketRef.file(key);

    await fileRef.save(fileBuffer, {
      resumable: false,
      contentType: mimeType,
      metadata: {
        contentType: mimeType,
      },
    });

    return `gs://${targetBucket}/${key}`;
  } catch (error: any) {
    console.error('[uploadToStorageService] Error uploading file to storage:', {
      error: error?.message || error,
      key,
      provider: env.STORAGE_PROVIDER,
    });
    throw error;
  }
};
