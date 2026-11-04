import { TimelineBid } from '../../interfaces/timeline.interface';

export interface RawBidInput {
  t: number;
  amount: number;
  bidder: string;
}

export const coalesceBidsService = (bids: RawBidInput[], gapSec: number = 0.4): TimelineBid[] => {
  let out: TimelineBid[] = [];

  try {
    if (!bids || bids.length === 0) {
      return [];
    }

    const sorted = [...bids].sort((a, b) => a.t - b.t);

    for (const b of sorted) {
      const last = out.length > 0 ? out[out.length - 1] : null;

      if (last !== null && b.t - last.t < gapSec) {
        // Coalesce burst into previous bid
        out[out.length - 1] = {
          t: b.t,
          amount: b.amount,
          bidder: b.bidder,
          burst: last.burst + 1,
        };
      } else {
        out.push({
          t: Math.round(b.t * 1000) / 1000,
          amount: b.amount,
          bidder: b.bidder,
          burst: 1,
        });
      }
    }

    return out;
  } catch (error: any) {
    console.error('[coalesceBidsService] Error coalescing bids:', error?.message || error);
    return [];
  }
};
