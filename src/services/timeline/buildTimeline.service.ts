import { ReelTimeline, TimelineResult, TimelineCue } from '../../interfaces/timeline.interface';
import { StreamAuctionItem } from '../external';
import { StreamClock } from '../media/buildStreamClock.service';
import { LotWindow } from '../../interfaces/lot.interface';
import { LatencyState } from '../../interfaces/job.interface';
import { ReelConfig } from '../../interfaces/theme.interface';
import { CleanedWord } from '../../interfaces/transcript.interface';
import { buildDeadlineHistoryService } from './buildDeadlineHistory.service';
import { matchCuesService, MatchedCue } from './matchCues.service';
import { coalesceBidsService } from './coalesceBids.service';
import { chunkCaptionsService } from './chunkCaptions.service';

export interface BuildTimelineParams {
  auction: StreamAuctionItem;
  words: CleanedWord[];
  clock: StreamClock;
  window: LotWindow;
  latency: LatencyState;
  lotNo: number;
  lotTotal: number;
  storeName?: string;
  clipDuration?: number;
  cfg: ReelConfig;
}

export const scheduleCues = (
  cues: MatchedCue[],
  avoidWindows: Array<{ start: number; end: number }>,
  maxOnScreen: number = 2,
): TimelineCue[] => {
  const scheduled: TimelineCue[] = [];

  for (const c of cues) {
    if (c.id === 'first_item') continue;

    // Avoid collision with burst windows
    const overlapsAvoid = avoidWindows.some((w) => !(c.t1 < w.start || c.t0 > w.end));
    if (overlapsAvoid) continue;

    // Check count currently on screen
    const concurrentCount = scheduled.filter((s) => !(c.t1 <= s.t0 || c.t0 >= s.t1)).length;

    if (concurrentCount < maxOnScreen) {
      scheduled.push({
        id: c.id,
        t0: c.t0,
        t1: c.t1,
        amount: c.amount,
      });
    }
  }

  return scheduled;
};

export const buildTimelineService = (params: BuildTimelineParams): ReelTimeline => {
  let v: (isoOrMs: string | number) => number;
  let dh: ReturnType<typeof buildDeadlineHistoryService>;
  let allCues: MatchedCue[];
  let firstItemCue: MatchedCue | undefined;
  let liveT: number;
  let closeT: number;
  let closedAtT: number;
  let soldAnchor: CleanedWord | undefined;
  let soldT: number;
  let result: TimelineResult;
  let scheduledCues: TimelineCue[];
  let captions: ReturnType<typeof chunkCaptionsService>;
  let endT: number;
  let startingPriceNum: number;
  let maxEnd: number;

  const { auction, words, clock, window, latency, lotNo, lotTotal, storeName, clipDuration, cfg } =
    params;

  try {
    // Wall-clock -> clip seconds mapper: c(E) = clock.toMedia(E) - window.m0 + latency.seconds
    v = (isoOrMs: string | number): number => {
      const mediaSec = clock.toMedia(isoOrMs);
      const clipSec = mediaSec - window.m0 + latency.seconds;
      return Math.round(clipSec * 1000) / 1000;
    };

    dh = buildDeadlineHistoryService(auction, auction.extension_window_ms || 10000);
    allCues = matchCuesService(words, cfg);
    firstItemCue = allCues.find((c) => c.id === 'first_item');

    liveT = v(auction.started_at);
    closeT = v(auction.ends_at);
    closedAtT = v(auction.closed_at);

    // Look for sold anchor in words within [closed_at, closed_at + 15s]
    soldAnchor = words.find((w) => {
      const norm = (w.text || w.word).toLowerCase().replace(/[^a-z]/g, '');
      const isSoldWord = (cfg.anchors?.sold || []).some((pat) =>
        pat.some((tok) => tok.toLowerCase() === norm),
      );
      return isSoldWord && w.start >= closedAtT && w.start <= closedAtT + 15;
    });

    soldT = soldAnchor ? soldAnchor.start : closedAtT + 1.0;
    soldT = Math.round(soldT * 1000) / 1000;

    startingPriceNum = parseFloat(String(auction.starting_price)) || 0;

    if (auction.winner && auction.winner.winning_amount) {
      result = {
        kind: 'sold',
        t: soldT,
        amount: parseFloat(String(auction.winner.winning_amount)) || 0,
        winner: auction.winner.display_name || 'Winner',
      };
    } else if (auction.close_reason === 'admin_cancelled') {
      result = {
        kind: 'cancelled',
        t: closedAtT,
      };
    } else {
      result = {
        kind: 'unsold',
        t: closedAtT,
      };
    }

    // Schedule cues avoiding live announcement (live ± 2.2), close burst (close ± 1.7), finale (sold ± 4)
    scheduledCues = scheduleCues(allCues, [
      { start: liveT - 2.2, end: liveT + 2.2 },
      { start: closeT - 1.7, end: closeT + 1.7 },
      { start: soldT - 4.0, end: soldT + 4.0 },
    ]);

    captions = chunkCaptionsService(words);

    maxEnd = Math.max(closedAtT + (cfg.window?.post_roll_min_s || 10), soldT + 4);
    endT = clipDuration ? Math.min(clipDuration, maxEnd) : maxEnd;
    endT = Math.round(endT * 1000) / 1000;

    return {
      version: 1,
      meta: {
        stream_id: auction.product_id ? 70278 : 0, // updated by caller if needed
        auction_id: auction.auction_id,
        lot_no: lotNo,
        lot_total: lotTotal,
        store: storeName || 'Zoop Live',
        starting_price: startingPriceNum,
        currency: auction.currency || 'INR',
        latency_s: latency.seconds,
      },
      intro: {
        t0: firstItemCue ? firstItemCue.t0 : 0.5,
        t1: Math.max(0.6, liveT - 0.3),
      },
      live: {
        t: liveT,
      },
      bids: coalesceBidsService(
        (auction.bids || []).map((b) => ({
          t: v(b.submitted_at),
          amount: parseFloat(String(b.amount)) || 0,
          bidder: b.bidder_display_name,
        })),
        cfg.bids?.coalesce_s || 0.4,
      ),
      deadline: {
        ok: dh.ok,
        segments: dh.hist.map((h) => ({
          t: v(h.at),
          ends: v(h.ends),
        })),
      },
      close: {
        t: closeT,
      },
      result,
      cues: scheduledCues,
      captions,
      end: endT,
    };
  } catch (error: any) {
    console.error('[buildTimelineService] Error assembling timeline:', error?.message || error, {
      auctionId: auction.auction_id,
    });
    throw error;
  }
};
