import { PubSub } from '@google-cloud/pubsub';
import { env } from '../../../config/env';
import { loadServiceAccountCredentials } from '../../../config/loadServiceAccountCredentials';

let pubSubInstance: PubSub | null = null;

export const getPubSubClient = (): PubSub => {
  let creds: any;

  try {
    if (!pubSubInstance) {
      creds = loadServiceAccountCredentials();
      pubSubInstance = new PubSub({
        projectId: env.GCP_PROJECT_ID || creds?.projectId,
        credentials: creds
          ? {
              client_email: creds.clientEmail,
              private_key: creds.privateKey,
            }
          : undefined,
      });
    }
    return pubSubInstance;
  } catch (error: any) {
    console.error('[getPubSubClient] Error initializing PubSub client:', error?.message || error);
    throw error;
  }
};

export const resetPubSubClient = (): void => {
  pubSubInstance = null;
};
