import { getFirestoreDb } from './firestore';
import { AuctionReelLot, LotArtifacts, LotStatus, LotWindow } from '../interfaces/lot.interface';
import { JobCounts, ThemePin } from '../interfaces/job.interface';
import { MAX_LOT_ATTEMPTS } from '../config/defaults';
import { env } from '../config/env';

export class AuctionReelLotModel {
  private static getCollection(streamId: number): FirebaseFirestore.CollectionReference {
    const db = getFirestoreDb();
    const collectionName = env.FIRESTORE_JOBS_COLLECTION || 'auction_reels_jobs';
    return db.collection(collectionName).doc(String(streamId)).collection('lots');
  }

  public static async createMany(streamId: number, lots: Partial<AuctionReelLot>[]): Promise<void> {
    let collection: FirebaseFirestore.CollectionReference;
    let batch: FirebaseFirestore.WriteBatch;
    let db: FirebaseFirestore.Firestore;
    let nowStr: string;

    try {
      db = getFirestoreDb();
      collection = this.getCollection(streamId);
      batch = db.batch();
      nowStr = new Date().toISOString();

      for (const lot of lots) {
        if (!lot.id) continue;
        const ref = collection.doc(lot.id);
        const docData: AuctionReelLot = {
          id: lot.id,
          lot_number: lot.lot_number || 1,
          product_id: lot.product_id || 0,
          status: lot.status || 'PENDING',
          attempts: lot.attempts || { prepare: 0, render: 0 },
          last_error: lot.last_error || null,
          theme: lot.theme || { id: 'default', version: 1 },
          renderer_version: lot.renderer_version,
          summary: lot.summary || {
            started_at: '',
            closed_at: '',
            bid_count: 0,
          },
          window: lot.window,
          flags: lot.flags || [],
          artifacts: lot.artifacts || {},
          created_at: nowStr,
          updated_at: nowStr,
        };
        batch.set(ref, docData, { merge: true });
      }

      await batch.commit();
    } catch (error: any) {
      console.error('[AuctionReelLotModel.createMany] Error:', error?.message || error, {
        streamId,
        count: lots.length,
      });
      throw error;
    }
  }

  public static async get(streamId: number, auctionId: string): Promise<AuctionReelLot | null> {
    let collection: FirebaseFirestore.CollectionReference;
    let snap: FirebaseFirestore.DocumentSnapshot;

    try {
      collection = this.getCollection(streamId);
      snap = await collection.doc(auctionId).get();
      if (!snap.exists) return null;
      return snap.data() as AuctionReelLot;
    } catch (error: any) {
      console.error('[AuctionReelLotModel.get] Error:', error?.message || error, {
        streamId,
        auctionId,
      });
      throw error;
    }
  }

  public static async listAll(streamId: number): Promise<AuctionReelLot[]> {
    let collection: FirebaseFirestore.CollectionReference;
    let snapshot: FirebaseFirestore.QuerySnapshot;
    let lots: AuctionReelLot[] = [];

    try {
      collection = this.getCollection(streamId);
      snapshot = await collection.orderBy('lot_number', 'asc').get();
      lots = snapshot.docs.map((d) => d.data() as AuctionReelLot);
      return lots;
    } catch (error: any) {
      console.error('[AuctionReelLotModel.listAll] Error:', error?.message || error, {
        streamId,
      });
      throw error;
    }
  }

  public static async listByStatus(
    streamId: number,
    statuses: LotStatus[],
  ): Promise<AuctionReelLot[]> {
    let collection: FirebaseFirestore.CollectionReference;
    let snapshot: FirebaseFirestore.QuerySnapshot;
    let lots: AuctionReelLot[] = [];

    try {
      collection = this.getCollection(streamId);
      if (statuses.length === 1) {
        snapshot = await collection.where('status', '==', statuses[0]).get();
      } else {
        snapshot = await collection.where('status', 'in', statuses).get();
      }
      lots = snapshot.docs.map((d) => d.data() as AuctionReelLot);
      lots.sort((a, b) => a.lot_number - b.lot_number);
      return lots;
    } catch (error: any) {
      console.error('[AuctionReelLotModel.listByStatus] Error:', error?.message || error, {
        streamId,
        statuses,
      });
      throw error;
    }
  }

  public static async markPrepared(
    streamId: number,
    auctionId: string,
    data: { window: LotWindow; artifacts: LotArtifacts },
  ): Promise<void> {
    let collection: FirebaseFirestore.CollectionReference;
    let ref: FirebaseFirestore.DocumentReference;

    try {
      collection = this.getCollection(streamId);
      ref = collection.doc(auctionId);
      await ref.update({
        status: 'PREPARED',
        window: data.window,
        artifacts: data.artifacts,
        last_error: null,
        updated_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[AuctionReelLotModel.markPrepared] Error:', error?.message || error, {
        streamId,
        auctionId,
      });
      throw error;
    }
  }

  public static async markRendered(
    streamId: number,
    auctionId: string,
    status: LotStatus,
    data: { flags: string[]; artifacts: LotArtifacts; renderer_version?: string },
  ): Promise<void> {
    let collection: FirebaseFirestore.CollectionReference;
    let ref: FirebaseFirestore.DocumentReference;

    try {
      collection = this.getCollection(streamId);
      ref = collection.doc(auctionId);
      await ref.update({
        status,
        flags: data.flags,
        artifacts: data.artifacts,
        renderer_version: data.renderer_version,
        last_error: null,
        updated_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[AuctionReelLotModel.markRendered] Error:', error?.message || error, {
        streamId,
        auctionId,
        status,
      });
      throw error;
    }
  }

  public static async recordFailure(
    streamId: number,
    auctionId: string,
    stage: 'prepare' | 'render',
    errorMessage: string,
    maxAttempts: number = MAX_LOT_ATTEMPTS,
  ): Promise<void> {
    let collection: FirebaseFirestore.CollectionReference;
    let ref: FirebaseFirestore.DocumentReference;
    let db: FirebaseFirestore.Firestore;

    try {
      db = getFirestoreDb();
      collection = this.getCollection(streamId);
      ref = collection.doc(auctionId);

      await db.runTransaction(async (tx): Promise<void> => {
        let snap: FirebaseFirestore.DocumentSnapshot;
        let lot: AuctionReelLot;
        let currentAttempts: number;
        let nextAttempts: number;
        let isFinalFailure: boolean;

        snap = await tx.get(ref);
        if (!snap.exists) return;

        lot = snap.data() as AuctionReelLot;
        currentAttempts = lot.attempts?.[stage] ?? 0;
        nextAttempts = currentAttempts + 1;
        isFinalFailure = nextAttempts >= maxAttempts;

        tx.update(ref, {
          [`attempts.${stage}`]: nextAttempts,
          status: isFinalFailure ? 'FAILED' : lot.status,
          last_error: errorMessage,
          updated_at: new Date().toISOString(),
        });
      });
    } catch (error: any) {
      console.error('[AuctionReelLotModel.recordFailure] Error:', error?.message || error, {
        streamId,
        auctionId,
        stage,
      });
      throw error;
    }
  }

  public static async anyRetryable(
    streamId: number,
    stage: 'prepare' | 'render',
    maxAttempts: number = MAX_LOT_ATTEMPTS,
  ): Promise<boolean> {
    let allLots: AuctionReelLot[];
    let hasRetryable: boolean = false;

    try {
      allLots = await this.listAll(streamId);
      for (const lot of allLots) {
        if (lot.status === 'FAILED' || lot.status === 'SKIPPED') {
          continue;
        }
        if (stage === 'prepare' && lot.status === 'PENDING') {
          if ((lot.attempts?.prepare ?? 0) < maxAttempts) {
            hasRetryable = true;
            break;
          }
        }
        if (stage === 'render' && lot.status === 'PREPARED') {
          if ((lot.attempts?.render ?? 0) < maxAttempts) {
            hasRetryable = true;
            break;
          }
        }
      }
      return hasRetryable;
    } catch (error: any) {
      console.error('[AuctionReelLotModel.anyRetryable] Error:', error?.message || error, {
        streamId,
        stage,
      });
      return false;
    }
  }

  public static async count(streamId: number, status: LotStatus): Promise<number> {
    let collection: FirebaseFirestore.CollectionReference;
    let snapshot: FirebaseFirestore.QuerySnapshot;

    try {
      collection = this.getCollection(streamId);
      snapshot = await collection.where('status', '==', status).get();
      return snapshot.size;
    } catch (error: any) {
      console.error('[AuctionReelLotModel.count] Error:', error?.message || error, {
        streamId,
        status,
      });
      return 0;
    }
  }

  public static async countsByStatus(streamId: number): Promise<JobCounts> {
    let allLots: AuctionReelLot[];
    let counts: JobCounts = {
      total: 0,
      prepared: 0,
      done: 0,
      needs_review: 0,
      failed: 0,
    };

    try {
      allLots = await this.listAll(streamId);
      counts.total = allLots.length;
      for (const lot of allLots) {
        if (lot.status === 'PREPARED') counts.prepared++;
        else if (lot.status === 'DONE') counts.done++;
        else if (lot.status === 'NEEDS_REVIEW') counts.needs_review++;
        else if (lot.status === 'FAILED') counts.failed++;
      }
      return counts;
    } catch (error: any) {
      console.error('[AuctionReelLotModel.countsByStatus] Error:', error?.message || error, {
        streamId,
      });
      return counts;
    }
  }

  public static async resetLotForRetry(
    streamId: number,
    auctionId: string,
    newThemePin?: ThemePin,
  ): Promise<void> {
    let collection: FirebaseFirestore.CollectionReference;
    let ref: FirebaseFirestore.DocumentReference;
    let updatePayload: Record<string, any>;

    try {
      collection = this.getCollection(streamId);
      ref = collection.doc(auctionId);
      updatePayload = {
        status: 'PREPARED',
        attempts: { prepare: 0, render: 0 },
        last_error: null,
        flags: [],
        updated_at: new Date().toISOString(),
      };
      if (newThemePin) {
        updatePayload.theme = newThemePin;
      }
      await ref.update(updatePayload);
    } catch (error: any) {
      console.error('[AuctionReelLotModel.resetLotForRetry] Error:', error?.message || error, {
        streamId,
        auctionId,
      });
      throw error;
    }
  }

  public static async getUnprocessedLots(streamId: number): Promise<AuctionReelLot[]> {
    let collection: FirebaseFirestore.CollectionReference;
    let snapshot: FirebaseFirestore.QuerySnapshot;
    let lots: AuctionReelLot[] = [];

    try {
      collection = this.getCollection(streamId);
      snapshot = await collection.orderBy('lot_number', 'asc').get();

      for (const doc of snapshot.docs) {
        const lot = doc.data() as AuctionReelLot;
        if (lot.status !== 'COMPLETED' && lot.status !== 'DONE') {
          lots.push(lot);
        }
      }

      return lots;
    } catch (error: any) {
      console.error('[AuctionReelLotModel.getUnprocessedLots] Error:', error?.message || error, {
        streamId,
      });
      return [];
    }
  }

  public static async incrementRetry(streamId: number, auctionId: string): Promise<number> {
    let collection: FirebaseFirestore.CollectionReference;
    let docRef: FirebaseFirestore.DocumentReference;
    let newRetryCount: number = 1;

    try {
      collection = this.getCollection(streamId);
      docRef = collection.doc(auctionId);

      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data() as AuctionReelLot;
        newRetryCount = (data.retry_count || 0) + 1;
      }

      await docRef.update({
        retry_count: newRetryCount,
        status: 'PROCESSING',
        updated_at: new Date().toISOString(),
      });

      return newRetryCount;
    } catch (error: any) {
      console.error('[AuctionReelLotModel.incrementRetry] Error:', error?.message || error, {
        streamId,
        auctionId,
      });
      throw error;
    }
  }

  public static async markCompleted(
    streamId: number,
    auctionId: string,
    artifacts: any,
  ): Promise<void> {
    let collection: FirebaseFirestore.CollectionReference;
    let docRef: FirebaseFirestore.DocumentReference;
    let nowStr: string;

    try {
      collection = this.getCollection(streamId);
      docRef = collection.doc(auctionId);
      nowStr = new Date().toISOString();

      await docRef.set(
        {
          status: 'COMPLETED',
          artifacts,
          completed_at: nowStr,
          updated_at: nowStr,
        },
        { merge: true },
      );
    } catch (error: any) {
      console.error('[AuctionReelLotModel.markCompleted] Error:', error?.message || error, {
        streamId,
        auctionId,
      });
      throw error;
    }
  }

  public static async markFailed(
    streamId: number,
    auctionId: string,
    errorMessage: string,
  ): Promise<void> {
    let collection: FirebaseFirestore.CollectionReference;
    let docRef: FirebaseFirestore.DocumentReference;
    let nowStr: string;

    try {
      collection = this.getCollection(streamId);
      docRef = collection.doc(auctionId);
      nowStr = new Date().toISOString();

      await docRef.set(
        {
          status: 'FAILED',
          last_error: errorMessage,
          updated_at: nowStr,
        },
        { merge: true },
      );
    } catch (error: any) {
      console.error('[AuctionReelLotModel.markFailed] Error:', error?.message || error, {
        streamId,
        auctionId,
      });
      throw error;
    }
  }

  public static async markSkipped(
    streamId: number,
    auctionId: string,
    reason: string,
  ): Promise<void> {
    let collection: FirebaseFirestore.CollectionReference;
    let docRef: FirebaseFirestore.DocumentReference;
    let nowStr: string;

    try {
      collection = this.getCollection(streamId);
      docRef = collection.doc(auctionId);
      nowStr = new Date().toISOString();

      await docRef.set(
        {
          status: 'SKIPPED',
          last_error: reason,
          updated_at: nowStr,
        },
        { merge: true },
      );
    } catch (error: any) {
      console.error('[AuctionReelLotModel.markSkipped] Error:', error?.message || error, {
        streamId,
        auctionId,
      });
      throw error;
    }
  }
}
