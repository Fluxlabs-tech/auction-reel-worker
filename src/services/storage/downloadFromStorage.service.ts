import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { env } from '../../config/env';
import { getGcsClient } from '../external/gcs/gcsClient';
import { getS3Client } from '../external/s3/s3Client';

export interface DownloadOptions {
  bucket?: string;
}

export const downloadFromStorageService = async (
  key: string,
  options?: DownloadOptions,
): Promise<Buffer> => {
  let targetBucket: string;
  let gcsClient: any;
  let bucketRef: any;
  let fileRef: any;
  let downloaded: [Buffer];
  let s3Client: any;
  let s3Command: any;
  let s3Response: any;
  let stream: Readable;
  let chunks: Buffer[] = [];

  try {
    targetBucket =
      options?.bucket || (env.STORAGE_PROVIDER === 'aws' ? env.S3_BUCKET : env.REELS_BUCKET);

    if (env.STORAGE_PROVIDER === 'aws') {
      s3Client = getS3Client();
      s3Command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });
      s3Response = await s3Client.send(s3Command);
      stream = s3Response.Body as Readable;

      return await new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', (err: any) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    }

    // Default: GCP Cloud Storage
    gcsClient = getGcsClient();
    bucketRef = gcsClient.bucket(targetBucket);
    fileRef = bucketRef.file(key);
    downloaded = await fileRef.download();

    return downloaded[0];
  } catch (error: any) {
    console.error('[downloadFromStorageService] Error downloading file from storage:', {
      error: error?.message || error,
      key,
      provider: env.STORAGE_PROVIDER,
    });
    throw error;
  }
};
