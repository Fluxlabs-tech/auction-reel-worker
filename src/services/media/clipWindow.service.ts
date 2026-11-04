import { StreamClock } from './buildStreamClock.service';
import { ReelConfig } from '../../interfaces/theme.interface';
import { LotWindow } from '../../interfaces/lot.interface';

export interface AuctionTimeBounds {
  started_at: string;
  closed_at: string;
}

export const clipWindowService = (
  currentAuction: AuctionTimeBounds,
  clock: StreamClock,
  latencyPriorSec: number,
  configWindow: ReelConfig['window'],
  prevAuction?: AuctionTimeBounds | null,
  nextAuction?: AuctionTimeBounds | null,
): LotWindow => {
  let startedMs: number;
  let closedMs: number;
  let preRollMs: number;
  let postRollMaxMs: number;
  let neighbourGapMs: number;
  let startMs: number;
  let endMs: number;
  let m0: number;
  let m1: number;

  try {
    startedMs = new Date(currentAuction.started_at).getTime();
    closedMs = new Date(currentAuction.closed_at).getTime();

    preRollMs = configWindow.pre_roll_s * 1000;
    postRollMaxMs = configWindow.post_roll_max_s * 1000;
    neighbourGapMs = configWindow.neighbour_gap_s * 1000;

    // Start with pre-roll, bounded by previous auction close
    startMs = startedMs - preRollMs;
    if (prevAuction && prevAuction.closed_at) {
      const prevClosedMs = new Date(prevAuction.closed_at).getTime();
      startMs = Math.max(startMs, prevClosedMs + neighbourGapMs);
    }

    // End with post-roll, bounded by next auction start
    endMs = closedMs + postRollMaxMs;
    if (nextAuction && nextAuction.started_at) {
      const nextStartMs = new Date(nextAuction.started_at).getTime();
      endMs = Math.min(endMs, nextStartMs - neighbourGapMs);
    }

    // Convert to media time and add latency prior
    m0 = Math.max(0, clock.toMedia(startMs) + latencyPriorSec);
    m1 = Math.max(m0 + 1, clock.toMedia(endMs) + latencyPriorSec);

    return {
      m0: Math.round(m0 * 1000) / 1000,
      m1: Math.round(m1 * 1000) / 1000,
    };
  } catch (error: any) {
    console.error('[clipWindowService] Error computing clip window:', error?.message || error, {
      currentAuction,
    });
    throw error;
  }
};
