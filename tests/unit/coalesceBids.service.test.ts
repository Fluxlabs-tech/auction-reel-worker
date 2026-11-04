import { coalesceBidsService } from '../../src/services/timeline/coalesceBids.service';

describe('coalesceBidsService', () => {
  it('should coalesce rapid burst bids within 0.4s', () => {
    const rawBids = [
      { t: 10.0, amount: 200, bidder: 'Alice' },
      { t: 10.2, amount: 250, bidder: 'Bob' }, // within 0.2s of 10.0 -> burst
      { t: 10.35, amount: 300, bidder: 'Charlie' }, // within 0.15s of 10.2 -> burst
      { t: 12.0, amount: 400, bidder: 'Dave' }, // 1.65s later -> separate bid
    ];

    const coalesced = coalesceBidsService(rawBids, 0.4);
    expect(coalesced).toHaveLength(2);
    expect(coalesced[0].burst).toBe(3);
    expect(coalesced[0].amount).toBe(300);
    expect(coalesced[0].bidder).toBe('Charlie');

    expect(coalesced[1].burst).toBe(1);
    expect(coalesced[1].amount).toBe(400);
  });
});
