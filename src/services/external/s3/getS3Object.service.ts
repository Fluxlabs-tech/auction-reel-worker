import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import axios from 'axios';
import { getS3Client } from './s3Client';
import { env } from '../../../config/env';

export const getS3ObjectService = async (
  key: string,
  bucket: string = env.S3_BUCKET,
): Promise<Buffer> => {
  let s3: any;
  let command: any;
  let response: any;
  let stream: Readable;
  let chunks: Buffer[] = [];
  let cdnUrl: string;
  let cdnResponse: any;

  try {
    try {
      s3 = getS3Client();
      command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      response = await s3.send(command);
      stream = response.Body as Readable;

      return await new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', (err: any) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (s3Error: any) {
      if (env.ZOOP_CDN_BASE_URL && (!bucket || bucket === env.S3_BUCKET)) {
        console.warn(
          `[getS3ObjectService] S3 read failed for key "${key}" (${s3Error?.message || s3Error}). Falling back to CDN...`,
        );
        cdnUrl = `${env.ZOOP_CDN_BASE_URL.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
        cdnResponse = await axios.get(cdnUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
        });
        return Buffer.from(cdnResponse.data);
      }
      throw s3Error;
    }
  } catch (error: any) {
    console.error('[getS3ObjectService] Error reading S3 or CDN object:', error?.message || error, {
      bucket,
      key,
    });
    throw error;
  }
};
