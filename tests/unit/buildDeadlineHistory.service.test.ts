import { buildDeadlineHistoryService } from '../../src/services/timeline/buildDeadlineHistory.service';
import { StreamAuctionItem } from '../../src/services/external/getStreamAuctionTimeline.service';

describe('buildDeadlineHistoryService', () => {
  it('should replay deadline extensions and validate matches', () => {
    // 15 second initial duration
    // Bid 1 at started + 8s (timeLeft = 7s <= 10s window) -> new deadline = 8 + 10 = 18s (ext = 3s)
    // Bid 2 at started + 12s (timeLeft = 6s <= 10s window) -> new deadline = 12 + 10 = 22s (ext = 4s)
    // Total extension = 7s (7000ms), ends_at = started + 22s
    const startedAt = '2026-10-29T15:00:00.000Z';
    const bid1Time = '2026-10-29T15:00:08.000Z';
    const bid2Time = '2026-10-29T15:00:12.000Z';
    const endsAt = '2026-10-29T15:00:22.000Z';

    const auction: StreamAuctionItem = {
      auction_id: 'test-auction-1',
      product_id: 101,
      status: 'settled',
      close_reason: 'timer',
      starting_price: 200,
      currency: 'INR',
      closing_rule_type: 'time_bound',
      closing_rule_config: { duration_seconds: 15 },
      started_at: startedAt,
      ends_at: endsAt,
      closed_at: endsAt,
      extension_used_ms: 7000,
      winner_count: 1,
      bids: [
        { submitted_at: bid1Time, amount: '300.00', bidder_display_name: 'Alice' },
        { submitted_at: bid2Time, amount: '400.00', bidder_display_name: 'Bob' },
      ],
      winner: { slot_rank: 1, winning_amount: '400.00', display_name: 'Bob' },
    };

    const result = buildDeadlineHistoryService(auction, 10000);
    expect(result.ok).toBe(true);
    expect(result.totalExtensionMs).toBe(7000);
    expect(result.hist).toHaveLength(3); // Initial + 2 extensions
    expect(new Date(result.finalDeadlineMs).toISOString()).toBe(endsAt);
  });

  it('should flag ok: false if replayed deadline mismatches actual ends_at', () => {
    const startedAt = '2026-10-29T15:00:00.000Z';
    const endsAt = '2026-10-29T15:00:50.000Z'; // 50s but no bids to account for it

    const auction: StreamAuctionItem = {
      auction_id: 'mismatch-auction',
      product_id: 102,
      status: 'settled',
      close_reason: 'timer',
      starting_price: 200,
      currency: 'INR',
      closing_rule_type: 'time_bound',
      closing_rule_config: { duration_seconds: 15 },
      started_at: startedAt,
      ends_at: endsAt,
      closed_at: endsAt,
      extension_used_ms: 0,
      winner_count: 0,
      bids: [],
      winner: null,
    };

    const result = buildDeadlineHistoryService(auction, 10000);
    expect(result.ok).toBe(false);
  });
});
