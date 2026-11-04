import { getFirestoreDb } from './firestore';

export interface HeartbeatState {
  worker_id: string;
  last_seen: string;
  version: string;
  current_stream_id: number | null;
  current_step: string | null;
  memory?: NodeJS.MemoryUsage;
}

export class ReelServerStateModel {
  private static collectionName = 'reel_server_state';

  public static async getDiscoveryCursor(): Promise<string | null> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let snap: FirebaseFirestore.DocumentSnapshot;
    let defaultCursor: string;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc('discovery');
      snap = await docRef.get();

      if (!snap.exists) {
        // Default to 24 hours ago in RFC3339 format
        defaultCursor = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        return defaultCursor;
      }

      return (snap.data() as { cursor?: string })?.cursor || null;
    } catch (error: any) {
      console.error('[ReelServerStateModel.getDiscoveryCursor] Error:', error?.message || error);
      defaultCursor = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      return defaultCursor;
    }
  }

  public static async setDiscoveryCursor(cursor: string): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc('discovery');
      await docRef.set({
        cursor,
        updated_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[ReelServerStateModel.setDiscoveryCursor] Error:', error?.message || error, {
        cursor,
      });
      throw error;
    }
  }

  public static async writeHeartbeat(
    workerId: string,
    state: {
      streamId?: number | null;
      step?: string | null;
      version: string;
    },
  ): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let payload: HeartbeatState;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc('heartbeat');
      payload = {
        worker_id: workerId,
        last_seen: new Date().toISOString(),
        version: state.version,
        current_stream_id: state.streamId ?? null,
        current_step: state.step ?? null,
        memory: process.memoryUsage(),
      };
      await docRef.set(payload);
    } catch (error: any) {
      console.error('[ReelServerStateModel.writeHeartbeat] Error:', error?.message || error, {
        workerId,
      });
    }
  }

  public static async getHeartbeat(): Promise<HeartbeatState | null> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let snap: FirebaseFirestore.DocumentSnapshot;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc('heartbeat');
      snap = await docRef.get();
      if (!snap.exists) return null;
      return snap.data() as HeartbeatState;
    } catch (error: any) {
      console.error('[ReelServerStateModel.getHeartbeat] Error:', error?.message || error);
      return null;
    }
  }
}
