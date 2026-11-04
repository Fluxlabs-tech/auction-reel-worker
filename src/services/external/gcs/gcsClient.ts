import { Storage } from '@google-cloud/storage';
import { env } from '../../../config/env';
import { loadServiceAccountCredentials } from '../../../config/loadServiceAccountCredentials';

let storageInstance: Storage | null = null;

export const getGcsClient = (): Storage => {
  let creds: any;

  try {
    if (!storageInstance) {
      creds = loadServiceAccountCredentials();
      storageInstance = new Storage({
        projectId: env.GCP_PROJECT_ID || creds?.projectId,
        credentials: creds
          ? {
              client_email: creds.clientEmail,
              private_key: creds.privateKey,
            }
          : undefined,
      });
    }
    return storageInstance;
  } catch (error: any) {
    console.error('[getGcsClient] Error initializing Storage client:', error?.message || error);
    throw error;
  }
};
