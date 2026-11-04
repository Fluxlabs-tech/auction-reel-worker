import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env';
import { getGcsClient } from '../external/gcs/gcsClient';
import { getS3Client } from '../external/s3/s3Client';

export interface CheckOptions {
  bucket?: string;
}

export const checkObjectExistsService = async (
  key: string,
  options?: CheckOptions,
): Promise<boolean> => {
  let targetBucket: string;
  let gcsClient: any;
  let bucketRef: any;
  let fileRef: any;
  let existsRes: [boolean];
  let s3Client: any;
  let s3Command: any;

  try {
    targetBucket =
      options?.bucket || (env.STORAGE_PROVIDER === 'aws' ? env.S3_BUCKET : env.REELS_BUCKET);

    if (env.STORAGE_PROVIDER === 'aws') {
      try {
        s3Client = getS3Client();
        s3Command = new HeadObjectCommand({
          Bucket: targetBucket,
          Key: key,
        });
        await s3Client.send(s3Command);
        return true;
      } catch (headErr: any) {
        if (headErr?.name === 'NotFound' || headErr?.$metadata?.httpStatusCode === 404) {
          return false;
        }
        throw headErr;
      }
    }

    // Default: GCP Cloud Storage
    gcsClient = getGcsClient();
    bucketRef = gcsClient.bucket(targetBucket);
    fileRef = bucketRef.file(key);
    existsRes = await fileRef.exists();

    return existsRes[0];
  } catch (error: any) {
    console.error('[checkObjectExistsService] Error checking object existence:', {
      error: error?.message || error,
      key,
      provider: env.STORAGE_PROVIDER,
    });
    return false;
  }
};
