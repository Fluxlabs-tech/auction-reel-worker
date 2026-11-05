import { ReelServerStateModel } from '../../models/reelServerState.model';
import { AuctionReelJobModel } from '../../models/auctionReelJob.model';
import {
  getStreamsWithClosedAuctionsService,
  getStreamSummaryService,
  publishAuctionReelEventService,
} from '../external';
import { GIVE_UP_AFTER_MS } from '../../config/defaults';

export const isStreamSkippable = (summary: any): { skippable: boolean; reason?: string } => {
  if (summary.rehearsal) {
    return { skippable: true, reason: 'rehearsal_stream' };
  }
  if (summary.stream_duration !== undefined && summary.stream_duration < 120) {
    return { skippable: true, reason: 'duration_too_short' };
  }
  return { skippable: false };
};

export const runDiscoveryTickService = async (): Promise<number> => {
  let cursor: string | null;
  let page: any;
  let processedCount: number = 0;
  let nowMs: number;
  let streamId: number;
  let alreadyExists: boolean;
  let summary: any;
  let skipCheck: { skippable: boolean; reason?: string };

  try {
    nowMs = Date.now();
    cursor = await ReelServerStateModel.getDiscoveryCursor();
    if (!cursor) {
      cursor = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
    }

    page = await getStreamsWithClosedAuctionsService(cursor, 200);

    for (const s of page.streams || []) {
      streamId = s.stream_id;
      alreadyExists = await AuctionReelJobModel.exists(streamId);
      if (alreadyExists) {
        continue;
      }

      summary = {};
      try {
        summary = await getStreamSummaryService(streamId);
      } catch (_sumErr) {
        summary = {};
      }

      skipCheck = isStreamSkippable(summary);
      if (skipCheck.skippable) {
        await AuctionReelJobModel.createSkipped(streamId, skipCheck.reason || 'skipped');
        await publishAuctionReelEventService({
          status: 'SKIPPED',
          stream_id: streamId,
          reason: skipCheck.reason || 'skipped',
        });
        processedCount++;
        continue;
      }

      await AuctionReelJobModel.create(streamId, {
        seller_id: summary.seller_id,
        store_id: summary.store_identifier,
        step: 'WAITING',
        status: 'ACTIVE',
        next_run_at: nowMs + 5 * 60 * 1000,
        readiness: {
          auctions_closed: false,
          playlist_final: false,
          checked_at: new Date(nowMs).toISOString(),
          give_up_at: new Date(nowMs + GIVE_UP_AFTER_MS).toISOString(),
        },
      });

      processedCount++;
    }

    if (page.next_cursor) {
      await ReelServerStateModel.setDiscoveryCursor(page.next_cursor);
    }

    return processedCount;
  } catch (error: any) {
    console.error(
      '[runDiscoveryTickService] Error running discovery tick:',
      error?.message || error,
    );
    return processedCount;
  }
};
