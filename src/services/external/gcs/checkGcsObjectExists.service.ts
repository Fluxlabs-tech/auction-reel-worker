import { getGcsClient } from './gcsClient';
import { env } from '../../../config/env';

export const checkGcsObjectExistsService = async (targetPathOrUri: string): Promise<boolean> => {
  let gcs: any;
  let bucketName: string;
  let filePath: string;
  let bucket: any;
  let file: any;
  let existsRes: [boolean];

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

    bucket = gcs.bucket(bucketName);
    file = bucket.file(filePath);
    existsRes = await file.exists();

    return existsRes[0];
  } catch (error: any) {
    console.error(
      '[checkGcsObjectExistsService] Error checking GCS object existence:',
      error?.message || error,
      { targetPathOrUri },
    );
    return false;
  }
};
