import { HeadObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import { getS3Client } from './s3Client';
import { env } from '../../../config/env';

export interface S3HeadResult {
  LastModified?: Date;
  lastModified?: Date;
  ContentLength?: number;
  contentLength?: number;
  ContentType?: string;
  contentType?: string;
}

export const headS3ObjectService = async (
  key: string,
  bucket: string = env.S3_BUCKET,
): Promise<S3HeadResult> => {
  let s3: any;
  let command: any;
  let response: any;
  let cdnUrl: string;
  let cdnResponse: any;
  let lastModStr: string | undefined;
  let lastModDate: Date | undefined;
  let contentLength: number | undefined;
  let contentType: string | undefined;

  try {
    try {
      s3 = getS3Client();
      command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      response = await s3.send(command);

      return {
        LastModified: response.LastModified,
        lastModified: response.LastModified,
        ContentLength: response.ContentLength,
        contentLength: response.ContentLength,
        ContentType: response.ContentType,
        contentType: response.ContentType,
      };
    } catch (s3Error: any) {
      if (env.ZOOP_CDN_BASE_URL && (!bucket || bucket === env.S3_BUCKET)) {
        cdnUrl = `${env.ZOOP_CDN_BASE_URL.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
        cdnResponse = await axios.head(cdnUrl, { timeout: 10000 });
        lastModStr = cdnResponse.headers['last-modified'];
        lastModDate = lastModStr ? new Date(lastModStr) : undefined;
        contentLength = cdnResponse.headers['content-length']
          ? parseInt(cdnResponse.headers['content-length'], 10)
          : undefined;
        contentType = cdnResponse.headers['content-type'];

        return {
          LastModified: lastModDate,
          lastModified: lastModDate,
          ContentLength: contentLength,
          contentLength: contentLength,
          ContentType: contentType,
          contentType: contentType,
        };
      }
      throw s3Error;
    }
  } catch (error: any) {
    console.error(
      '[headS3ObjectService] Error executing HEAD on S3 or CDN:',
      error?.message || error,
      {
        bucket,
        key,
      },
    );
    throw error;
  }
};
