import { ReelTimeline } from '../../src/interfaces/timeline.interface';
import { DEFAULT_THEME_VERSION } from '../../src/config/defaults';
import {
  buildBidCardLines,
  buildCountdownRingLines,
  buildBurstLines,
  buildConfettiLines,
  buildFinaleLines,
} from '../../src/render/ass/components';
import { assFontSize } from '../../src/render/ass/fontSize';
import { measureAssTextWidth } from '../../src/render/ass/measureAssText';
import { buildHudAssService } from '../../src/services/render/buildHudAss.service';

const toSec = (t: string): number => {
  const [h, m, s] = t.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};

const span = (line: string): { t0: number; t1: number } => {
  const m = line.match(/^Dialogue: \d+,([^,]+),([^,]+),/);
  if (!m) throw new Error(`not a dialogue line: ${line}`);
  return { t0: toSec(m[1]), t1: toSec(m[2]) };
};

// Rapid-fire bidding like stream 70277 lot 20: bids every ~0.6s, each resetting a 10s window
const rapidTimeline: ReelTimeline = {
  version: 1,
  meta: {
    stream_id: 70277,
    auction_id: '01a187bb-9ec5-74e1-a7d9-89096c7e5282',
    lot_no: 20,
    lot_total: 43,
    store: '',
    starting_price: 50,
    currency: 'INR',
    latency_s: 2,
  },
  intro: { t0: 0.5, t1: 11.7 },
  live: { t: 12 },
  bids: [
    { t: 14.4, amount: 150, bidder: 'nilaykumar', burst: 1 },
    { t: 17.46, amount: 250, bidder: 'shashank5851', burst: 1 },
    { t: 18.07, amount: 275, bidder: 'kunal7984', burst: 1 },
    { t: 18.64, amount: 300, bidder: 'nilaykumar', burst: 1 },
    { t: 19.26, amount: 325, bidder: 'divyam', burst: 1 },
  ],
  deadline: {
    ok: true,
    segments: [
      { t: 12, ends: 27 },
      { t: 17.46, ends: 27.46 },
      { t: 18.07, ends: 28.07 },
      { t: 18.64, ends: 28.64 },
      { t: 19.26, ends: 29.26 },
    ],
  },
  close: { t: 29.26 },
  result: { kind: 'sold', t: 30.1, amount: 325, winner: 'divyam' },
  cues: [],
  captions: [],
  end: 36,
};

describe('ASS overlay regressions', () => {
  test('font sizes compensate for Poppins win-metrics so a 46px design amount is not rendered at 26px', () => {
    expect(assFontSize(46)).toBe(81);
    expect(assFontSize(16)).toBe(28);
  });

  test('text measurement uses real glyph advances and adds letter spacing', () => {
    const plain = measureAssTextWidth('CURRENT BID', 15, 'heavy');
    const spaced = measureAssTextWidth('CURRENT BID', 15, 'heavy', 2);
    expect(plain).toBeGreaterThan(80);
    expect(plain).toBeLessThan(140);
    expect(spaced - plain).toBe(22);
  });

  test('new-bid flash only animates the border and never paints an opaque fill over the amount', () => {
    const lines = buildBidCardLines(rapidTimeline, DEFAULT_THEME_VERSION);
    const flashes = lines.filter((l) => l.startsWith('Dialogue: 4,') && l.includes(',Drawing,'));

    expect(flashes.length).toBe(rapidTimeline.bids.length);
    for (const f of flashes) {
      expect(f).toContain('\\1a&HFF&');
      expect(f).not.toContain('\\c&H00000000');
      expect(f).not.toMatch(/\\t\([^)]*\\alpha/);
    }
  });

  test('bid card switches to FINAL BID at close and clears before the SOLD finale', () => {
    const lines = buildBidCardLines(rapidTimeline, DEFAULT_THEME_VERSION);
    const finaleStart = rapidTimeline.result.t - 0.22;
    const finalLabel = lines.find((l) => l.endsWith('FINAL BID'));

    expect(finalLabel).toBeDefined();
    expect(span(finalLabel as string).t0).toBeCloseTo(rapidTimeline.close.t, 2);
    for (const l of lines) {
      expect(span(l).t1).toBeLessThanOrEqual(finaleStart + 0.31);
    }
  });

  test('countdown ring never shows two digits at once when bids reset the timer', () => {
    const lines = buildCountdownRingLines(rapidTimeline, DEFAULT_THEME_VERSION);
    const digits = lines
      .filter((l) => l.startsWith('Dialogue: 4,') && l.includes(',HUD,'))
      .map(span)
      .sort((a, b) => a.t0 - b.t0);

    expect(digits.length).toBeGreaterThan(0);
    for (let i = 1; i < digits.length; i++) {
      expect(digits[i].t0).toBeGreaterThanOrEqual(digits[i - 1].t1 - 0.005);
    }
  });

  test('countdown ring draws at most one progress arc per instant', () => {
    const lines = buildCountdownRingLines(rapidTimeline, DEFAULT_THEME_VERSION);
    const arcs = lines
      .filter((l) => l.startsWith('Dialogue: 3,') && l.includes(',Drawing,'))
      .map(span);
    // arc + its round caps share each slice: at any sampled instant exactly 0 or 2 layer-3 drawings
    for (let t = 12.05; t < 29.2; t += 0.137) {
      const active = arcs.filter((a) => a.t0 <= t && t < a.t1).length;
      expect(active === 0 || active === 2).toBe(true);
    }
  });

  test('reset chip is throttled instead of strobing on every rapid bid', () => {
    const lines = buildCountdownRingLines(rapidTimeline, DEFAULT_THEME_VERSION);
    const chips = lines.filter((l) => l.includes('RESET TO 10s'));
    expect(chips.length).toBe(1);
  });

  test("TIME'S UP burst is cut before the SOLD stamp lands", () => {
    const lines = buildBurstLines(rapidTimeline, DEFAULT_THEME_VERSION);
    const finaleStart = rapidTimeline.result.t - 0.22;
    const closeBurst = lines.filter((l) => span(l).t0 >= rapidTimeline.close.t - 0.001);

    expect(closeBurst.length).toBeGreaterThan(0);
    for (const l of closeBurst) {
      expect(span(l).t1).toBeLessThanOrEqual(finaleStart + 0.001);
    }
  });

  test('confetti is deterministic per auction and absent for unsold lots', () => {
    const a = buildConfettiLines(rapidTimeline, DEFAULT_THEME_VERSION);
    const b = buildConfettiLines(rapidTimeline, DEFAULT_THEME_VERSION);
    const unsold = buildConfettiLines(
      { ...rapidTimeline, result: { kind: 'unsold', t: 30.1 } },
      DEFAULT_THEME_VERSION,
    );

    expect(a.length).toBeGreaterThan(20);
    expect(a).toEqual(b);
    expect(unsold).toEqual([]);
  });

  test('unsold finale renders a single stamp without winner or price', () => {
    const lines = buildFinaleLines(
      { ...rapidTimeline, result: { kind: 'unsold', t: 30.1 } },
      DEFAULT_THEME_VERSION,
    );
    const text = lines.join('\n');
    expect(text).toContain('UNSOLD');
    expect(text).not.toContain('WINNER');
  });

  test('full HUD script has no unpositioned events (libass would collision-shift them)', () => {
    const ass = buildHudAssService(rapidTimeline, DEFAULT_THEME_VERSION);
    const events = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));

    expect(events.length).toBeGreaterThan(100);
    for (const e of events) {
      expect(e).toMatch(/\\(pos|move)\(/);
    }
  });
});
