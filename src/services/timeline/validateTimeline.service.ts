import { ReelTimeline } from '../../interfaces/timeline.interface';
import { StreamAuctionItem } from '../external';
import { LatencyState } from '../../interfaces/job.interface';

export const validateTimelineService = (
  tl: ReelTimeline,
  auction: StreamAuctionItem,
  latencyState?: LatencyState,
): string[] => {
  let flags: string[] = [];
  let maxBidAmount: number = 0;

  try {
    // 1. LOW_SYNC
    if (latencyState && latencyState.confidence === 'low') {
      flags.push('LOW_SYNC');
    }

    // 2. DEADLINE_MISMATCH
    if (!tl.deadline || !tl.deadline.ok) {
      flags.push('DEADLINE_MISMATCH');
    }

    // 3. NO_SPEECH
    if (!tl.captions || tl.captions.length === 0) {
      flags.push('NO_SPEECH');
    }

    // 4. BID_AFTER_CLOSE
    for (const b of tl.bids || []) {
      if (b.t > tl.close.t + 0.5) {
        flags.push('BID_AFTER_CLOSE');
        break;
      }
    }

    // 5. WINNER_MISMATCH
    if (tl.result.kind === 'sold') {
      for (const b of tl.bids || []) {
        if (b.amount > maxBidAmount) {
          maxBidAmount = b.amount;
        }
      }
      if (tl.bids && tl.bids.length > 0 && Math.abs(tl.result.amount - maxBidAmount) > 0.01) {
        flags.push('WINNER_MISMATCH');
      }
    }

    // 6. OUT_OF_CLIP
    if (tl.live.t < 0 || tl.close.t > tl.end) {
      flags.push('OUT_OF_CLIP');
    }

    return flags;
  } catch (error: any) {
    console.error('[validateTimelineService] Error validating timeline:', error?.message || error, {
      auctionId: auction.auction_id,
    });
    return ['VALIDATION_ERROR'];
  }
};
