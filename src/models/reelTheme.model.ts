import { getFirestoreDb } from './firestore';
import { ReelThemeDoc, ReelThemeVersion } from '../interfaces/theme.interface';
import { DEFAULT_THEME_VERSION } from '../config/defaults';

export class ReelThemeModel {
  private static collectionName = 'reel_themes';

  public static async getActiveThemes(): Promise<{ id: string; doc: ReelThemeDoc }[]> {
    let db: FirebaseFirestore.Firestore;
    let snap: FirebaseFirestore.QuerySnapshot;
    let results: { id: string; doc: ReelThemeDoc }[] = [];

    try {
      db = getFirestoreDb();
      snap = await db.collection(this.collectionName).where('status', '==', 'active').get();

      results = snap.docs.map((d) => ({
        id: d.id,
        doc: d.data() as ReelThemeDoc,
      }));
      return results;
    } catch (error: any) {
      console.error('[ReelThemeModel.getActiveThemes] Error:', error?.message || error);
      return [];
    }
  }

  public static async getThemeDoc(themeId: string): Promise<ReelThemeDoc | null> {
    let db: FirebaseFirestore.Firestore;
    let snap: FirebaseFirestore.DocumentSnapshot;

    try {
      db = getFirestoreDb();
      snap = await db.collection(this.collectionName).doc(themeId).get();
      if (!snap.exists) return null;
      return snap.data() as ReelThemeDoc;
    } catch (error: any) {
      console.error('[ReelThemeModel.getThemeDoc] Error:', error?.message || error, { themeId });
      return null;
    }
  }

  public static async getThemeVersion(
    themeId: string,
    version: number,
  ): Promise<ReelThemeVersion | null> {
    let db: FirebaseFirestore.Firestore;
    let snap: FirebaseFirestore.DocumentSnapshot;

    try {
      db = getFirestoreDb();
      snap = await db
        .collection(this.collectionName)
        .doc(themeId)
        .collection('versions')
        .doc(String(version))
        .get();

      if (!snap.exists) {
        if (themeId === 'default') {
          return DEFAULT_THEME_VERSION;
        }
        return null;
      }
      return snap.data() as ReelThemeVersion;
    } catch (error: any) {
      console.error('[ReelThemeModel.getThemeVersion] Error:', error?.message || error, {
        themeId,
        version,
      });
      return themeId === 'default' ? DEFAULT_THEME_VERSION : null;
    }
  }

  public static async saveThemeVersion(
    themeId: string,
    version: number,
    themeVersion: ReelThemeVersion,
  ): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let ref: FirebaseFirestore.DocumentReference;

    try {
      db = getFirestoreDb();
      ref = db
        .collection(this.collectionName)
        .doc(themeId)
        .collection('versions')
        .doc(String(version));

      await ref.set(themeVersion);
    } catch (error: any) {
      console.error('[ReelThemeModel.saveThemeVersion] Error:', error?.message || error, {
        themeId,
        version,
      });
      throw error;
    }
  }
}
