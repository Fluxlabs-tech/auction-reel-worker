import { StreamAuctionItem } from '../external';

export interface DeadlineHistorySegment {
  at: string; // ISO string when segment started
  ends: string; // ISO string when deadline was set to expire
  atMs: number;
  endsMs: number;
}

export interface DeadlineHistoryResult {
  hist: DeadlineHistorySegment[];
  ok: boolean;
  totalExtensionMs: number;
  finalDeadlineMs: number;
}

export const buildDeadlineHistoryService = (
  auction: StreamAuctionItem,
  extensionWindowMs: number,
): DeadlineHistoryResult => {
  let startedMs: number;
  let durationSec: number;
  let initialDeadlineMs: number;
  let currentDeadlineMs: number;
  let totalExtensionMs: number = 0;
  let hist: DeadlineHistorySegment[] = [];
  let sortedBids: typeof auction.bids;
  let actualEndsMs: number;
  let ok: boolean;

  try {
    startedMs = new Date(auction.started_at).getTime();
    durationSec = auction.closing_rule_config?.duration_seconds || 15;
    initialDeadlineMs = startedMs + durationSec * 1000;
    currentDeadlineMs = initialDeadlineMs;

    hist.push({
      at: auction.started_at,
      ends: new Date(initialDeadlineMs).toISOString(),
      atMs: startedMs,
      endsMs: initialDeadlineMs,
    });

    // Chronologically sorted accepted bids
    sortedBids = [...(auction.bids || [])].sort(
      (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
    );

    for (const bid of sortedBids) {
      const bidMs = new Date(bid.submitted_at).getTime();
      const timeLeftMs = currentDeadlineMs - bidMs;

      // Anti-snipe rule: if bid lands within extension window
      if (timeLeftMs >= 0 && timeLeftMs <= extensionWindowMs) {
        const newDeadlineMs = bidMs + extensionWindowMs;
        totalExtensionMs += newDeadlineMs - currentDeadlineMs;
        currentDeadlineMs = newDeadlineMs;

        hist.push({
          at: bid.submitted_at,
          ends: new Date(newDeadlineMs).toISOString(),
          atMs: bidMs,
          endsMs: newDeadlineMs,
        });
      }
    }

    actualEndsMs = new Date(auction.ends_at).getTime();
    const deadlineDiff = Math.abs(currentDeadlineMs - actualEndsMs);
    const extensionDiff = Math.abs(totalExtensionMs - (auction.extension_used_ms || 0));

    // Valid if both deadline and extension match within 200ms
    ok = deadlineDiff < 200 && extensionDiff < 200;

    return {
      hist,
      ok,
      totalExtensionMs,
      finalDeadlineMs: currentDeadlineMs,
    };
  } catch (error: any) {
    console.error(
      '[buildDeadlineHistoryService] Error replaying deadline history:',
      error?.message || error,
      { auctionId: auction.auction_id },
    );
    return {
      hist: [],
      ok: false,
      totalExtensionMs: 0,
      finalDeadlineMs: 0,
    };
  }
};
