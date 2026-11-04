import { headS3ObjectService } from './headS3Object.service';
import { env } from '../../../config/env';

export const checkS3ObjectExistsService = async (
  key: string,
  bucket: string = env.S3_BUCKET,
): Promise<boolean> => {
  let result: any;

  try {
    result = await headS3ObjectService(key, bucket);
    return Boolean(result);
  } catch (error: any) {
    if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
      return false;
    }
    console.error('[checkS3ObjectExistsService] Error checking S3 object existence:', {
      error: error?.message || error,
      bucket,
      key,
    });
    return false;
  }
};
