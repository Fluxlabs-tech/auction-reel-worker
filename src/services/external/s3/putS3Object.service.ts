import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from './s3Client';
import { env } from '../../../config/env';

export const putS3ObjectService = async (
  key: string,
  body: Buffer | string,
  contentType: string = 'application/octet-stream',
  bucket: string = env.S3_BUCKET,
): Promise<string> => {
  let s3: any;
  let command: any;
  let bufferBody: Buffer;

  try {
    s3 = getS3Client();
    bufferBody = typeof body === 'string' ? Buffer.from(body, 'utf-8') : body;

    command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bufferBody,
      ContentType: contentType,
    });

    await s3.send(command);
    return key.replace(/^\/+/, '');
  } catch (error: any) {
    console.error('[putS3ObjectService] Error uploading to S3:', error?.message || error, {
      bucket,
      key,
    });
    throw error;
  }
};
