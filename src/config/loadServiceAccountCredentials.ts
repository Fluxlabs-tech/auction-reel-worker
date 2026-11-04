import * as fs from 'fs';
import * as admin from 'firebase-admin';
import { env } from './env';

/**
 * Resolves GCP service account credentials from env.
 * Precedence: GCP_SERVICE_ACCOUNT_JSON (raw or base64 JSON) > GCP_SERVICE_ACCOUNT_KEY_PATH (key file).
 * Returns null when neither is set so callers can fall back to Application Default Credentials.
 * Throws on a configured-but-invalid key (fail-closed: never silently swap identities).
 */
export const loadServiceAccountCredentials = (): admin.ServiceAccount | null => {
  let rawJson: string | null = null;
  let parsed: Record<string, string | undefined> = {};

  try {
    if (env.GCP_SERVICE_ACCOUNT_JSON) {
      rawJson = env.GCP_SERVICE_ACCOUNT_JSON.trim().startsWith('{')
        ? env.GCP_SERVICE_ACCOUNT_JSON
        : Buffer.from(env.GCP_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8');
    } else if (env.GCP_SERVICE_ACCOUNT_KEY_PATH) {
      rawJson = fs.readFileSync(env.GCP_SERVICE_ACCOUNT_KEY_PATH, 'utf8');
    }

    if (!rawJson) {
      return null;
    }

    parsed = JSON.parse(rawJson);
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('Service account key is missing client_email or private_key');
    }

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      // Keys pasted into env files often carry literal "\n" sequences
      privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    };
  } catch (error: any) {
    console.error('[loadServiceAccountCredentials] Error:', error?.message || error);
    throw error;
  }
};
