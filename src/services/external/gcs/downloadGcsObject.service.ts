import { getGcsClient } from './gcsClient';
import { env } from '../../../config/env';

export const downloadGcsObjectService = async <T = any>(
  targetPathOrUri: string,
  asJson: boolean = true,
): Promise<T> => {
  let gcs: any;
  let bucketName: string;
  let filePath: string;
  let bucket: any;
  let file: any;
  let contents: [Buffer];
  let text: string;

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

    contents = await file.download();

    if (!asJson) {
      return contents[0] as unknown as T;
    }

    text = contents[0].toString('utf-8');
    return JSON.parse(text) as T;
  } catch (error: any) {
    console.error(
      '[downloadGcsObjectService] Error downloading from GCS:',
      error?.message || error,
      { targetPathOrUri },
    );
    throw error;
  }
};
