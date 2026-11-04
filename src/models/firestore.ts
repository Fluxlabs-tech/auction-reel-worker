import * as admin from 'firebase-admin';
import { env } from '../config/env';
import { loadServiceAccountCredentials } from '../config/loadServiceAccountCredentials';

let firestoreInstance: admin.firestore.Firestore | null = null;

export const getFirestoreDb = (): admin.firestore.Firestore => {
  let app: admin.app.App;
  let serviceAccount: admin.ServiceAccount | null = null;

  try {
    if (!firestoreInstance) {
      if (admin.apps.length === 0) {
        serviceAccount = loadServiceAccountCredentials();
        if (serviceAccount) {
          console.log(
            `[getFirestoreDb] Using service account credentials: ${serviceAccount.clientEmail}`,
          );
        } else {
          console.warn(
            '[getFirestoreDb] No service account configured, falling back to Application Default Credentials',
          );
        }
        app = admin.initializeApp({
          projectId: env.GCP_PROJECT_ID || serviceAccount?.projectId,
          credential: serviceAccount
            ? admin.credential.cert(serviceAccount)
            : admin.credential.applicationDefault(),
        });
      } else {
        app = admin.apps[0]!;
      }
      firestoreInstance = app.firestore();
      firestoreInstance.settings({ ignoreUndefinedProperties: true });
    }
    return firestoreInstance;
  } catch (error: any) {
    console.error('[getFirestoreDb] Error initializing Firestore:', error?.message || error);
    throw error;
  }
};
