import { getFirestoreDb } from './firestore';
import { ReelConfig } from '../interfaces/theme.interface';
import { DEFAULT_REEL_CONFIG } from '../config/defaults';

let cachedConfig: ReelConfig = DEFAULT_REEL_CONFIG;

export class ReelConfigModel {
  private static collectionName = 'reel_config';

  public static async getCurrentConfig(): Promise<ReelConfig> {
    let db: FirebaseFirestore.Firestore;
    let currentRef: FirebaseFirestore.DocumentReference;
    let currentSnap: FirebaseFirestore.DocumentSnapshot;
    let currentVersion: number;
    let configRef: FirebaseFirestore.DocumentReference;
    let configSnap: FirebaseFirestore.DocumentSnapshot;

    try {
      db = getFirestoreDb();
      currentRef = db.collection(this.collectionName).doc('current');
      currentSnap = await currentRef.get();

      if (!currentSnap.exists) {
        return cachedConfig;
      }

      currentVersion = (currentSnap.data() as { version?: number })?.version || 1;
      configRef = db.collection(this.collectionName).doc(String(currentVersion));
      configSnap = await configRef.get();

      if (!configSnap.exists) {
        return cachedConfig;
      }

      cachedConfig = configSnap.data() as ReelConfig;
      return cachedConfig;
    } catch (error: any) {
      console.error('[ReelConfigModel.getCurrentConfig] Error:', error?.message || error);
      return cachedConfig;
    }
  }

  public static getCachedConfig(): ReelConfig {
    return cachedConfig;
  }

  public static setCachedConfig(config: ReelConfig): void {
    cachedConfig = config;
  }

  public static async setConfig(version: number, config: ReelConfig): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let batch: FirebaseFirestore.WriteBatch;
    let currentRef: FirebaseFirestore.DocumentReference;
    let versionRef: FirebaseFirestore.DocumentReference;

    try {
      db = getFirestoreDb();
      batch = db.batch();
      versionRef = db.collection(this.collectionName).doc(String(version));
      currentRef = db.collection(this.collectionName).doc('current');

      batch.set(versionRef, config);
      batch.set(currentRef, { version, updated_at: new Date().toISOString() });
      await batch.commit();

      cachedConfig = config;
    } catch (error: any) {
      console.error('[ReelConfigModel.setConfig] Error:', error?.message || error, { version });
      throw error;
    }
  }
}
