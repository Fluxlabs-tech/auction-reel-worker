import { getFirestoreDb } from './firestore';
import { AuctionReelJob, JobStep, JobTranscriptState } from '../interfaces/job.interface';
import { env } from '../config/env';

export class AuctionReelJobModel {
  private static get collectionName(): string {
    return env.FIRESTORE_JOBS_COLLECTION || 'auction_reels_jobs';
  }

  public static async exists(streamId: number): Promise<boolean> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let snap: FirebaseFirestore.DocumentSnapshot;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));
      snap = await docRef.get();
      return snap.exists;
    } catch (error: any) {
      console.error('[AuctionReelJobModel.exists] Error:', error?.message || error, { streamId });
      return false;
    }
  }

  public static async create(
    streamId: number,
    data: Partial<AuctionReelJob>,
  ): Promise<AuctionReelJob> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let nowStr: string;
    let nowMs: number;
    let jobData: AuctionReelJob;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));
      nowStr = new Date().toISOString();
      nowMs = Date.now();

      jobData = {
        stream_id: streamId,
        seller_id: data.seller_id,
        store_id: data.store_id,
        schema_version: 1,
        step: data.step || 'WAITING',
        status: data.status || 'ACTIVE',
        skip_reason: data.skip_reason,
        next_run_at: data.next_run_at ?? nowMs,
        lease_until: null,
        worker_id: null,
        attempts: data.attempts || {},
        last_error: null,
        readiness: data.readiness || {
          auctions_closed: false,
          playlist_final: false,
          checked_at: nowStr,
        },
        counts: data.counts || {
          total: 0,
          prepared: 0,
          done: 0,
          needs_review: 0,
          failed: 0,
        },
        created_at: nowStr,
        updated_at: nowStr,
      };

      await docRef.set(jobData);
      return jobData;
    } catch (error: any) {
      console.error('[AuctionReelJobModel.create] Error:', error?.message || error, { streamId });
      throw error;
    }
  }

  public static async createSkipped(streamId: number, reason: string): Promise<void> {
    let nowMs: number;

    try {
      nowMs = Date.now();
      await this.create(streamId, {
        step: 'WAITING',
        status: 'SKIPPED',
        skip_reason: reason,
        next_run_at: nowMs + 365 * 24 * 60 * 60 * 1000,
      });
    } catch (error: any) {
      console.error('[AuctionReelJobModel.createSkipped] Error:', error?.message || error, {
        streamId,
        reason,
      });
      throw error;
    }
  }

  public static async get(streamId: number): Promise<AuctionReelJob | null> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let snap: FirebaseFirestore.DocumentSnapshot;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));
      snap = await docRef.get();
      if (!snap.exists) {
        return null;
      }
      return snap.data() as AuctionReelJob;
    } catch (error: any) {
      console.error('[AuctionReelJobModel.get] Error:', error?.message || error, { streamId });
      throw error;
    }
  }

  public static async claimNextDue(
    workerId: string,
    leaseMs: number,
  ): Promise<AuctionReelJob | null> {
    let db: FirebaseFirestore.Firestore;
    let nowMs: number;
    let snapshot: FirebaseFirestore.QuerySnapshot;
    let claimedJob: AuctionReelJob | null = null;

    try {
      db = getFirestoreDb();
      nowMs = Date.now();

      // Query active jobs due for execution
      snapshot = await db
        .collection(this.collectionName)
        .where('status', '==', 'ACTIVE')
        .where('next_run_at', '<=', nowMs)
        .orderBy('next_run_at', 'asc')
        .limit(10)
        .get();

      for (const doc of snapshot.docs) {
        claimedJob = await db.runTransaction(async (tx): Promise<AuctionReelJob | null> => {
          let txSnap: FirebaseFirestore.DocumentSnapshot;
          let currentData: AuctionReelJob;
          let leaseEnd: number;

          txSnap = await tx.get(doc.ref);
          if (!txSnap.exists) {
            return null;
          }

          currentData = txSnap.data() as AuctionReelJob;

          if (currentData.status !== 'ACTIVE') {
            return null;
          }
          if (currentData.next_run_at > nowMs) {
            return null;
          }
          if (currentData.lease_until && currentData.lease_until > nowMs) {
            return null;
          }

          leaseEnd = nowMs + leaseMs;
          tx.update(doc.ref, {
            lease_until: leaseEnd,
            next_run_at: leaseEnd, // hides it from other worker queries
            worker_id: workerId,
            updated_at: new Date().toISOString(),
          });

          return {
            ...currentData,
            lease_until: leaseEnd,
            next_run_at: leaseEnd,
            worker_id: workerId,
          };
        });

        if (claimedJob) {
          return claimedJob;
        }
      }

      return null;
    } catch (error: any) {
      console.error('[AuctionReelJobModel.claimNextDue] Error:', error?.message || error, {
        workerId,
      });
      return null;
    }
  }

  public static async renewLease(
    streamId: number,
    workerId: string,
    leaseMs: number,
  ): Promise<boolean> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let renewed: boolean = false;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));

      renewed = await db.runTransaction(async (tx): Promise<boolean> => {
        let snap: FirebaseFirestore.DocumentSnapshot;
        let data: AuctionReelJob;
        let newLeaseEnd: number;

        snap = await tx.get(docRef);
        if (!snap.exists) return false;

        data = snap.data() as AuctionReelJob;
        if (data.worker_id !== workerId) {
          return false;
        }

        newLeaseEnd = Date.now() + leaseMs;
        tx.update(docRef, {
          lease_until: newLeaseEnd,
          next_run_at: newLeaseEnd,
          updated_at: new Date().toISOString(),
        });
        return true;
      });

      return renewed;
    } catch (error: any) {
      console.error('[AuctionReelJobModel.renewLease] Error:', error?.message || error, {
        streamId,
        workerId,
      });
      return false;
    }
  }

  public static async advance(
    streamId: number,
    workerId: string,
    patch: Partial<AuctionReelJob> & { step: JobStep },
  ): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let nowMs: number;
    let nowStr: string;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));
      nowMs = Date.now();
      nowStr = new Date().toISOString();

      await db.runTransaction(async (tx): Promise<void> => {
        let snap: FirebaseFirestore.DocumentSnapshot;
        let currentData: AuctionReelJob;
        let updatePayload: Record<string, any>;

        snap = await tx.get(docRef);
        if (!snap.exists) {
          throw new Error(`Job ${streamId} does not exist`);
        }

        currentData = snap.data() as AuctionReelJob;
        if (currentData.worker_id !== workerId) {
          throw new Error(
            `Lease owner mismatch on advance: current worker ${currentData.worker_id} !== ${workerId}`,
          );
        }

        updatePayload = {
          ...patch,
          [`attempts.${patch.step}`]: 0,
          next_run_at: patch.next_run_at ?? (patch.step === 'DONE' ? nowMs + 86400000 : nowMs),
          lease_until: null,
          worker_id: null,
          last_error: null,
          updated_at: nowStr,
        };

        if (patch.step === 'DONE' && !updatePayload.status) {
          updatePayload.status = 'DONE';
        }

        tx.update(docRef, updatePayload);
      });
    } catch (error: any) {
      console.error('[AuctionReelJobModel.advance] Error:', error?.message || error, {
        streamId,
        workerId,
      });
      throw error;
    }
  }

  public static async reschedule(
    streamId: number,
    workerId: string,
    nextRunAt: number,
    patch?: Partial<AuctionReelJob>,
  ): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));

      await db.runTransaction(async (tx): Promise<void> => {
        let snap: FirebaseFirestore.DocumentSnapshot;
        let currentData: AuctionReelJob;

        snap = await tx.get(docRef);
        if (!snap.exists) return;

        currentData = snap.data() as AuctionReelJob;
        if (currentData.worker_id !== workerId) {
          console.warn('[AuctionReelJobModel.reschedule] Worker mismatch, ignoring reschedule.');
          return;
        }

        tx.update(docRef, {
          ...(patch || {}),
          next_run_at: nextRunAt,
          lease_until: null,
          worker_id: null,
          updated_at: new Date().toISOString(),
        });
      });
    } catch (error: any) {
      console.error('[AuctionReelJobModel.reschedule] Error:', error?.message || error, {
        streamId,
        workerId,
      });
      throw error;
    }
  }

  public static async backoff(
    streamId: number,
    workerId: string,
    attemptNumber: number,
    nextRunAt: number,
    errorMessage: string,
  ): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));

      await db.runTransaction(async (tx): Promise<void> => {
        let snap: FirebaseFirestore.DocumentSnapshot;
        let currentData: AuctionReelJob;

        snap = await tx.get(docRef);
        if (!snap.exists) return;

        currentData = snap.data() as AuctionReelJob;
        if (currentData.worker_id !== workerId) {
          console.warn('[AuctionReelJobModel.backoff] Worker mismatch, skipping.');
          return;
        }

        tx.update(docRef, {
          [`attempts.${currentData.step}`]: attemptNumber,
          next_run_at: nextRunAt,
          lease_until: null,
          worker_id: null,
          last_error: errorMessage,
          updated_at: new Date().toISOString(),
        });
      });
    } catch (error: any) {
      console.error('[AuctionReelJobModel.backoff] Error:', error?.message || error, {
        streamId,
        workerId,
      });
      throw error;
    }
  }

  public static async fail(
    streamId: number,
    workerId: string,
    errorMessage: string,
  ): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));

      await db.runTransaction(async (tx): Promise<void> => {
        let snap: FirebaseFirestore.DocumentSnapshot;
        let currentData: AuctionReelJob;

        snap = await tx.get(docRef);
        if (!snap.exists) return;

        currentData = snap.data() as AuctionReelJob;
        if (currentData.worker_id !== workerId) {
          console.warn('[AuctionReelJobModel.fail] Worker mismatch, skipping.');
          return;
        }

        tx.update(docRef, {
          status: 'FAILED',
          last_error: errorMessage,
          lease_until: null,
          worker_id: null,
          updated_at: new Date().toISOString(),
        });
      });
    } catch (error: any) {
      console.error('[AuctionReelJobModel.fail] Error:', error?.message || error, {
        streamId,
        workerId,
      });
      throw error;
    }
  }

  public static async releaseLease(streamId: number, workerId: string): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));

      await db.runTransaction(async (tx): Promise<void> => {
        let snap: FirebaseFirestore.DocumentSnapshot;
        let data: AuctionReelJob;

        snap = await tx.get(docRef);
        if (!snap.exists) return;

        data = snap.data() as AuctionReelJob;
        if (data.worker_id === workerId) {
          tx.update(docRef, {
            lease_until: null,
            worker_id: null,
            next_run_at: Date.now(),
            updated_at: new Date().toISOString(),
          });
        }
      });
    } catch (error: any) {
      console.error('[AuctionReelJobModel.releaseLease] Error:', error?.message || error, {
        streamId,
        workerId,
      });
    }
  }

  public static async releaseAllForWorker(workerId: string): Promise<number> {
    let db: FirebaseFirestore.Firestore;
    let snapshot: FirebaseFirestore.QuerySnapshot;
    let count: number = 0;

    try {
      db = getFirestoreDb();
      snapshot = await db.collection(this.collectionName).where('worker_id', '==', workerId).get();

      for (const doc of snapshot.docs) {
        await doc.ref.update({
          lease_until: null,
          worker_id: null,
          next_run_at: Date.now(),
          updated_at: new Date().toISOString(),
        });
        count++;
      }
      return count;
    } catch (error: any) {
      console.error('[AuctionReelJobModel.releaseAllForWorker] Error:', error?.message || error, {
        workerId,
      });
      return count;
    }
  }

  public static async resetForRetry(streamId: number, step?: JobStep): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let nowMs: number;
    let updatePayload: Record<string, any>;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));
      nowMs = Date.now();

      updatePayload = {
        status: 'ACTIVE',
        next_run_at: nowMs,
        lease_until: null,
        worker_id: null,
        attempts: {},
        last_error: null,
        updated_at: new Date().toISOString(),
      };

      if (step) {
        updatePayload.step = step;
      }

      await docRef.update(updatePayload);
    } catch (error: any) {
      console.error('[AuctionReelJobModel.resetForRetry] Error:', error?.message || error, {
        streamId,
        step,
      });
      throw error;
    }
  }

  public static async findActiveJobs(limit: number = 2): Promise<AuctionReelJob[]> {
    let db: FirebaseFirestore.Firestore;
    let collectionRef: FirebaseFirestore.CollectionReference;
    let snapshot: FirebaseFirestore.QuerySnapshot;
    let jobs: AuctionReelJob[] = [];
    let nowMs: number;

    try {
      db = getFirestoreDb();
      collectionRef = db.collection(this.collectionName);
      nowMs = Date.now();

      try {
        snapshot = await collectionRef
          .where('status', 'not-in', ['COMPLETED', 'FAILED', 'SKIPPED'])
          .limit(limit * 3)
          .get();
      } catch (_idxErr) {
        // Fallback if composite index not yet active
        snapshot = await collectionRef.limit(50).get();
      }

      for (const doc of snapshot.docs) {
        const data = doc.data() as AuctionReelJob;
        // Filter out terminal states
        if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'SKIPPED') {
          continue;
        }
        // Skip if currently actively leased by another worker and lease has not expired
        if (data.lease_until && data.lease_until > nowMs) {
          continue;
        }
        jobs.push(data);
        if (jobs.length >= limit) {
          break;
        }
      }

      return jobs;
    } catch (error: any) {
      console.error('[AuctionReelJobModel.findActiveJobs] Error querying active jobs:', {
        error: error?.message || error,
        limit,
      });
      return [];
    }
  }

  public static async claimJob(
    streamId: number,
    workerId: string,
    leaseMs: number = 15 * 60 * 1000,
  ): Promise<AuctionReelJob | null> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let claimedJob: AuctionReelJob | null = null;
    let nowMs: number;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));
      nowMs = Date.now();

      claimedJob = await db.runTransaction(async (tx): Promise<AuctionReelJob | null> => {
        let snap: FirebaseFirestore.DocumentSnapshot;
        let currentData: AuctionReelJob;
        let leaseEnd: number;

        snap = await tx.get(docRef);
        if (!snap.exists) {
          return null;
        }

        currentData = snap.data() as AuctionReelJob;
        if (
          currentData.status === 'COMPLETED' ||
          currentData.status === 'FAILED' ||
          currentData.status === 'SKIPPED'
        ) {
          return null;
        }
        if (currentData.lease_until && currentData.lease_until > nowMs) {
          return null;
        }

        leaseEnd = nowMs + leaseMs;
        tx.update(docRef, {
          status: 'PROCESSING',
          lease_until: leaseEnd,
          worker_id: workerId,
          updated_at: new Date().toISOString(),
        });

        return {
          ...currentData,
          status: 'PROCESSING',
          lease_until: leaseEnd,
          worker_id: workerId,
        };
      });

      return claimedJob;
    } catch (error: any) {
      console.error('[AuctionReelJobModel.claimJob] Error claiming job:', {
        error: error?.message || error,
        streamId,
        workerId,
      });
      return null;
    }
  }

  public static async updateTranscript(
    streamId: number,
    transcript: Partial<JobTranscriptState>,
  ): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let updatePayload: Record<string, any>;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));

      updatePayload = {
        transcript,
        updated_at: new Date().toISOString(),
      };

      await docRef.set(updatePayload, { merge: true });
    } catch (error: any) {
      console.error('[AuctionReelJobModel.updateTranscript] Error updating transcript:', {
        error: error?.message || error,
        streamId,
      });
      throw error;
    }
  }

  public static async saveAuctionData(
    streamId: number,
    auctionData: Record<string, any>,
    bidsData: any[],
  ): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let totalLots: number;
    let updatePayload: Record<string, any>;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));
      totalLots = Object.keys(auctionData || {}).length;

      updatePayload = {
        auction_data_present: true,
        auction: auctionData,
        auction_bids: bidsData,
        total_lots: totalLots,
        updated_at: new Date().toISOString(),
      };

      await docRef.set(updatePayload, { merge: true });
    } catch (error: any) {
      console.error('[AuctionReelJobModel.saveAuctionData] Error saving auction data:', {
        error: error?.message || error,
        streamId,
      });
      throw error;
    }
  }

  public static async markCompleted(streamId: number, counts?: any): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let nowStr: string;
    let updatePayload: Record<string, any>;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));
      nowStr = new Date().toISOString();

      updatePayload = {
        status: 'COMPLETED',
        step: 'DONE',
        lease_until: null,
        worker_id: null,
        completed_at: nowStr,
        updated_at: nowStr,
        ...(counts ? { counts } : {}),
      };

      await docRef.set(updatePayload, { merge: true });
    } catch (error: any) {
      console.error('[AuctionReelJobModel.markCompleted] Error completing job:', {
        error: error?.message || error,
        streamId,
      });
      throw error;
    }
  }

  public static async markFailed(streamId: number, error: string): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let nowStr: string;
    let updatePayload: Record<string, any>;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));
      nowStr = new Date().toISOString();

      updatePayload = {
        status: 'FAILED',
        lease_until: null,
        worker_id: null,
        last_error: error,
        updated_at: nowStr,
      };

      await docRef.set(updatePayload, { merge: true });
    } catch (err: any) {
      console.error('[AuctionReelJobModel.markFailed] Error marking job failed:', {
        error: err?.message || err,
        streamId,
      });
      throw err;
    }
  }

  public static async markSkipped(streamId: number, reason: string): Promise<void> {
    let db: FirebaseFirestore.Firestore;
    let docRef: FirebaseFirestore.DocumentReference;
    let nowStr: string;
    let updatePayload: Record<string, any>;

    try {
      db = getFirestoreDb();
      docRef = db.collection(this.collectionName).doc(String(streamId));
      nowStr = new Date().toISOString();

      updatePayload = {
        status: 'SKIPPED',
        step: 'DONE',
        skip_reason: reason,
        lease_until: null,
        worker_id: null,
        updated_at: nowStr,
      };

      await docRef.set(updatePayload, { merge: true });
    } catch (err: any) {
      console.error('[AuctionReelJobModel.markSkipped] Error marking job skipped:', {
        error: err?.message || err,
        streamId,
        reason,
      });
      throw err;
    }
  }
}
