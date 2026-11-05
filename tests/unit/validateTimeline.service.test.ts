import { validateTimelineService } from '../../src/services/timeline/validateTimeline.service';
import { ReelTimeline } from '../../src/interfaces/timeline.interface';
import { StreamAuctionItem } from '../../src/services/external';

describe('validateTimelineService', () => {
  it('should detect DEADLINE_MISMATCH, LOW_SYNC, and WINNER_MISMATCH flags', () => {
    const tl: ReelTimeline = {
      version: 1,
      meta: {
        stream_id: 70278,
        auction_id: 'a1',
        lot_no: 1,
        lot_total: 1,
        store: 'Test',
        starting_price: 100,
        currency: 'INR',
        latency_s: 2.0,
      },
      intro: { t0: 0.5, t1: 5.0 },
      live: { t: 5.5 },
      bids: [
        { t: 10.0, amount: 500, bidder: 'Alice', burst: 1 },
        { t: 15.0, amount: 600, bidder: 'Bob', burst: 1 },
      ],
      deadline: { ok: false, segments: [] }, // DEADLINE_MISMATCH
      close: { t: 20.0 },
      result: { kind: 'sold', t: 22.0, amount: 500, winner: 'Alice' }, // WINNER_MISMATCH (max bid is 600)
      cues: [],
      captions: [], // NO_SPEECH
      end: 26.0,
    };

    const auction: StreamAuctionItem = {
      auction_id: 'a1',
      product_id: 100,
      status: 'settled',
      close_reason: 'timer',
      starting_price: 100,
      currency: 'INR',
      closing_rule_type: 'time_bound',
      closing_rule_config: { duration_seconds: 15 },
      started_at: '2026-10-29T15:00:00Z',
      ends_at: '2026-10-29T15:00:20Z',
      closed_at: '2026-10-29T15:00:20Z',
      extension_used_ms: 5000,
      winner_count: 1,
      bids: [],
      winner: null,
    };

    const flags = validateTimelineService(tl, auction, {
      seconds: 2.0,
      matches: 0,
      confidence: 'low',
    });

    expect(flags).toContain('LOW_SYNC');
    expect(flags).toContain('DEADLINE_MISMATCH');
    expect(flags).toContain('NO_SPEECH');
    expect(flags).toContain('WINNER_MISMATCH');
  });
});
