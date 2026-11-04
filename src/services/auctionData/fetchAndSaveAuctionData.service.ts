import { AuctionReelLot } from '../../interfaces/lot.interface';
import { AuctionReelJobModel } from '../../models/auctionReelJob.model';
import { AuctionReelLotModel } from '../../models/auctionReelLot.model';
import {
  getStreamAuctionTimelineService,
  StreamAuctionItem,
  StreamAuctionTimelineResponse,
} from '../external/shareLeaderboard';
import { uploadToStorageService } from '../storage/uploadToStorage.service';
import { enqueueStreamService } from '../loops/enqueueStream.service';

export interface IngestAuctionDataResult {
  stream_id: number;
  total_lots: number;
  bids_count: number;
  auctions_count: number;
  storage_uri: string;
  updated_at: string;
  auctions: Record<string, any>;
}

export const fetchAndSaveAuctionDataService = async (
  streamId: number,
  providedTimeline?: StreamAuctionTimelineResponse,
): Promise<IngestAuctionDataResult> => {
  let jobExists: boolean = false;
  let timeline: StreamAuctionTimelineResponse | null = null;
  let auctions: StreamAuctionItem[] = [];
  let auctionsMap: Record<string, any> = {};
  let allBids: any[] = [];
  let existingLots: AuctionReelLot[] = [];
  let existingLotsMap: Map<string, AuctionReelLot> = new Map();
  let lotsPayload: Partial<AuctionReelLot>[] = [];
  let auctionsKey: string = '';
  let nowIso: string = '';
  let result: IngestAuctionDataResult;

  try {
    console.log(`[fetchAndSaveAuctionDataService] Ensuring job exists for stream ${streamId}...`);
    jobExists = await AuctionReelJobModel.exists(streamId);
    if (!jobExists) {
      console.log(
        `[fetchAndSaveAuctionDataService] Stream ${streamId} not yet enqueued. Initializing job document...`,
      );
      await enqueueStreamService(streamId, false);
    }

    if (providedTimeline && Array.isArray(providedTimeline.auctions)) {
      console.log(
        `[fetchAndSaveAuctionDataService] Using provided timeline payload with ${providedTimeline.auctions.length} auctions for stream ${streamId}`,
      );
      timeline = providedTimeline;
    } else {
      console.log(
        `[fetchAndSaveAuctionDataService] Fetching auction timeline for stream ${streamId} from share-leaderboard...`,
      );
      timeline = await getStreamAuctionTimelineService(streamId);
    }

    auctions = timeline?.auctions || [];

    for (const a of auctions) {
      auctionsMap[a.auction_id] = {
        auction_id: a.auction_id,
        product_id: a.product_id,
        varient_id: a.varient_id,
        status: a.status,
        close_reason: a.close_reason,
        starting_price: a.starting_price,
        currency: a.currency,
        closing_rule_type: a.closing_rule_type,
        closing_rule_config: a.closing_rule_config,
        extension_used_ms: a.extension_used_ms,
        started_at: a.started_at,
        ends_at: a.ends_at,
        closed_at: a.closed_at,
        winner: a.winner,
        bid_count: (a.bids || []).length,
      };

      for (const b of a.bids || []) {
        allBids.push({
          auction_id: a.auction_id,
          amount: b.amount,
          bidder_display_name: b.bidder_display_name,
          submitted_at: b.submitted_at,
        });
      }
    }

    // Sort all bids chronologically
    allBids.sort((x, y) => new Date(x.submitted_at).getTime() - new Date(y.submitted_at).getTime());

    // Save in Firebase database as auction->{auction_id}... auction_bids->[...]
    await AuctionReelJobModel.saveAuctionData(streamId, auctionsMap, allBids);

    // Fetch existing lots to preserve status (e.g. COMPLETED) and artifacts
    existingLots = await AuctionReelLotModel.listAll(streamId);
    existingLotsMap = new Map(existingLots.map((l) => [l.id, l]));

    nowIso = new Date().toISOString();
    lotsPayload = auctions.map((a: StreamAuctionItem, idx: number) => {
      const existing = existingLotsMap.get(a.auction_id);
      return {
        id: a.auction_id,
        lot_number: existing?.lot_number || idx + 1,
        product_id: a.product_id || existing?.product_id || 0,
        status: existing?.status || ('PENDING' as const),
        retry_count: existing?.retry_count ?? 0,
        max_retries: existing?.max_retries ?? 3,
        attempts: existing?.attempts || { prepare: 0, render: 0 },
        last_error: existing?.last_error || null,
        theme: existing?.theme || { id: 'default', version: 1 },
        renderer_version: existing?.renderer_version,
        auction: auctionsMap[a.auction_id],
        auction_bids: a.bids || [],
        summary: {
          started_at: a.started_at,
          closed_at: a.closed_at,
          bid_count: (a.bids || []).length,
          starting_price: a.starting_price,
          winning_amount: a.winner?.winning_amount ?? null,
          winner_display_name: a.winner?.display_name ?? null,
          close_reason: a.close_reason,
        },
        artifacts: existing?.artifacts || {},
        created_at: existing?.created_at || nowIso,
        updated_at: nowIso,
      };
    });

    if (lotsPayload.length > 0) {
      await AuctionReelLotModel.createMany(streamId, lotsPayload);
    }

    // Backup raw timeline JSON to configured storage bucket (GCP/AWS)
    auctionsKey = `auctions/${streamId}/auctions.json`;
    try {
      await uploadToStorageService(auctionsKey, JSON.stringify(timeline, null, 2), {
        contentType: 'application/json',
      });
    } catch (storageError: any) {
      console.warn(
        `[fetchAndSaveAuctionDataService] Non-fatal storage backup warning for stream ${streamId}:`,
        storageError?.message || storageError,
      );
    }

    result = {
      stream_id: streamId,
      total_lots: auctions.length,
      bids_count: allBids.length,
      auctions_count: Object.keys(auctionsMap).length,
      storage_uri: auctionsKey,
      updated_at: nowIso,
      auctions: auctionsMap,
    };

    console.log(
      `[fetchAndSaveAuctionDataService] Successfully ingested ${auctions.length} auctions and ${allBids.length} bids for stream ${streamId}`,
    );

    return result;
  } catch (error: any) {
    console.error(
      `[fetchAndSaveAuctionDataService] Error fetching auction data for stream ${streamId}:`,
      error?.message || error,
    );
    throw error;
  }
};
