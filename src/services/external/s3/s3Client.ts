import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../../../config/env';

let s3ClientInstance: S3Client | null = null;

export const getS3Client = (): S3Client => {
  try {
    if (!s3ClientInstance) {
      s3ClientInstance = new S3Client({
        region: env.AWS_REGION,
        credentials:
          env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
              }
            : undefined,
      });
    }
    return s3ClientInstance;
  } catch (error: any) {
    console.error('[getS3Client] Error initializing S3Client:', error?.message || error);
    throw error;
  }
};
