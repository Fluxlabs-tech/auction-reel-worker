import { AuctionReelJob, JobStep } from '../../interfaces/job.interface';
import {
  getStreamAuctionTimelineService,
  getStreamSummaryService,
  uploadGcsObjectService,
  publishAuctionReelEventService,
} from '../external';
import { selectThemeService } from '../render/selectTheme.service';
import { AuctionReelLotModel } from '../../models/auctionReelLot.model';
import { getStreamGcsPrefix, getLotGcsPrefix } from './helpers';

export const fetchAuctionsStepService = async (
  job: AuctionReelJob,
): Promise<{ next: JobStep; patch: Partial<AuctionReelJob> }> => {
  let timeline: any;
  let lots: any[];
  let streamPrefix: string;
  let summary: any;
  let selectedTheme: any;
  let lotCreationPayload: any[];

  try {
    timeline = await getStreamAuctionTimelineService(job.stream_id);
    streamPrefix = getStreamGcsPrefix(job.stream_id, job.created_at);

    // Save full timeline to GCS
    await uploadGcsObjectService(`${streamPrefix}auctions.json`, timeline);

    // Filter closed/settled auctions, sort chronologically by started_at
    lots = (timeline.auctions || [])
      .filter((a: any) => ['closed', 'settled'].includes(a.status))
      .sort(
        (a: any, b: any) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
      );

    if (lots.length === 0) {
      await publishAuctionReelEventService({
        status: 'SKIPPED',
        stream_id: job.stream_id,
        reason: 'no_auctions',
      });
      return {
        next: 'DONE',
        patch: {
          status: 'SKIPPED',
          skip_reason: 'no_auctions',
          updated_at: new Date().toISOString(),
        },
      };
    }

    try {
      summary = await getStreamSummaryService(job.stream_id);
    } catch (_summaryErr) {
      summary = { category: undefined, seller_store_name: undefined };
    }

    selectedTheme = await selectThemeService(job.store_id, summary.category);

    // Create Firestore lots docs idempotently
    lotCreationPayload = lots.map((a, idx) => ({
      id: a.auction_id,
      lot_number: idx + 1,
      product_id: a.product_id,
      status: 'PENDING' as const,
      attempts: { prepare: 0, render: 0 },
      theme: selectedTheme,
      summary: {
        started_at: a.started_at,
        closed_at: a.closed_at,
        bid_count: (a.bids || []).length,
        starting_price: a.starting_price,
        winning_amount: a.winner ? a.winner.winning_amount : null,
        winner_display_name: a.winner ? a.winner.display_name : null,
        close_reason: a.close_reason,
      },
      artifacts: {
        auction_json: `${streamPrefix}${String(idx + 1).padStart(2, '0')}_${a.auction_id}/auction.json`,
      },
    }));

    await AuctionReelLotModel.createMany(job.stream_id, lotCreationPayload);

    // Upload per-lot auction.json to GCS
    for (let i = 0; i < lots.length; i++) {
      const a = lots[i];
      const lotPrefix = getLotGcsPrefix(job.stream_id, i + 1, a.auction_id, job.created_at);
      await uploadGcsObjectService(`${lotPrefix}auction.json`, {
        ...a,
        extension_window_ms: timeline.extension_window_ms,
      });
    }

    return {
      next: 'BUILD_CLOCK',
      patch: {
        theme: selectedTheme,
        counts: {
          total: lots.length,
          prepared: 0,
          done: 0,
          needs_review: 0,
          failed: 0,
        },
        updated_at: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    console.error('[fetchAuctionsStepService] Error fetching auctions:', error?.message || error, {
      streamId: job.stream_id,
    });
    throw error;
  }
};
