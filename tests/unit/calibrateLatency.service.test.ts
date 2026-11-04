import { calibrateLatencyService } from '../../src/services/timeline/calibrateLatency.service';
import { StreamClock } from '../../src/services/media/buildStreamClock.service';
import { StreamAuctionItem } from '../../src/services/external/getStreamAuctionTimeline.service';
import { DEFAULT_REEL_CONFIG } from '../../src/config/defaults';

describe('calibrateLatencyService', () => {
  it('should calibrate latency matching §11 table to L = 2.0s', () => {
    // Stream 70278 lot 1 calibration test:
    // w0 = 2026-10-29 15:26:47.118 UTC
    // started_at: 15:36:14.487 UTC -> media = 567.369s
    // window.m0 = 557.369s (10s pre-roll)
    // ends_at = 15:36:51.330
    // bid 600 at 15:36:41.330
    const w0Ms = new Date('2026-10-29T15:26:47.118Z').getTime();

    const mockClock: StreamClock = {
      method: 'last_modified',
      groups: [{ group: 0, w0: w0Ms, mediaStartMin: 0, mediaStartMax: 2000 }],
      toMedia: (wall) => (new Date(wall).getTime() - w0Ms) / 1000,
      toWall: (m) => new Date(w0Ms + m * 1000),
    };

    const auction: StreamAuctionItem = {
      auction_id: '01a1884d',
      product_id: 1781347515,
      status: 'settled',
      close_reason: 'timer',
      starting_price: 200,
      currency: 'INR',
      closing_rule_type: 'time_bound',
      closing_rule_config: { duration_seconds: 15 },
      started_at: '2026-10-29T15:36:14.487Z',
      ends_at: '2026-10-29T15:36:51.330Z',
      closed_at: '2026-10-29T15:36:51.406Z',
      extension_used_ms: 21842,
      winner_count: 1,
      bids: [
        {
          submitted_at: '2026-10-29T15:36:41.330Z',
          amount: '600.00',
          bidder_display_name: 'Prashant',
        },
      ],
      winner: { slot_rank: 1, winning_amount: '600.00', display_name: 'Prashant' },
    };

    // Spoken transcript words:
    // "started" at 12.880s
    // "600" at 41.979s
    // "sold" at 54.979s
    const words = [
      { word: 'started', start: 12.88 },
      { word: '600', start: 41.979 },
      { word: 'sold', start: 54.979 },
    ];

    const result = calibrateLatencyService(
      [
        {
          auction,
          words,
          window: { m0: 557.369, m1: 616.349 },
        },
      ],
      mockClock,
      DEFAULT_REEL_CONFIG.latency,
      DEFAULT_REEL_CONFIG.anchors,
    );

    expect(result.L).toBeCloseTo(2.0, 1);
    expect(result.confidence).toBe('ok');
    expect(result.matches).toBeGreaterThanOrEqual(2);
  });
});
