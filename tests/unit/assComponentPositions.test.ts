import { ReelTimeline } from '../../src/interfaces/timeline.interface';
import { DEFAULT_THEME_VERSION } from '../../src/config/defaults';
import {
  buildIntroLines,
  buildHudLines,
  buildBidCardLines,
  buildCountdownRingLines,
  buildFinaleLines,
  buildCaptionsLines,
} from '../../src/render/ass/components';

describe('ASS Component Positions and Collision Avoidance', () => {
  const mockTimeline: ReelTimeline = {
    version: 1,
    meta: {
      stream_id: 70277,
      auction_id: '01a187a8-1414-7ce7-8e95-99f5f8f38435',
      lot_no: 1,
      lot_total: 43,
      store: 'DSC Store',
      starting_price: 50,
      currency: 'INR',
      latency_s: 2.0,
    },
    intro: { t0: 0.5, t1: 5.0 },
    live: { t: 5.5 },
    bids: [
      { t: 6.0, amount: 75, bidder: 'ayan1294', burst: 1 },
      { t: 8.0, amount: 100, bidder: 'winay', burst: 1 },
      { t: 12.0, amount: 500, bidder: 'sarth', burst: 1 },
    ],
    deadline: {
      ok: true,
      segments: [
        { t: 5.5, ends: 20.5 },
        { t: 12.0, ends: 22.0 },
      ],
    },
    close: { t: 22.0 },
    result: {
      kind: 'sold',
      t: 23.0,
      amount: 500,
      winner: 'sarth',
    },
    cues: [],
    captions: [],
    end: 28.0,
  };

  test('Intro component should slide every element with \\move and never mix in \\pos', () => {
    const lines = buildIntroLines(mockTimeline, DEFAULT_THEME_VERSION);
    // shadow + card + divider + title + subtitle
    expect(lines.length).toBe(5);

    for (const l of lines) {
      expect(l).toContain('\\move(');
      expect(l).not.toContain('\\pos(');
    }

    const textLines = lines.filter((l) => l.includes(',Default,'));
    expect(textLines.length).toBe(2);
    for (const t of textLines) {
      expect(t).toContain('\\move(360,');
      expect(t).toContain('\\an5');
    }
    expect(lines.join('\n')).toContain('#1');
    expect(lines.join('\n')).toContain('₹50');
  });

  test('HUD component lines should all be explicitly positioned to prevent collision shifting', () => {
    const lines = buildHudLines(mockTimeline, DEFAULT_THEME_VERSION);
    const drawingLines = lines.filter((l) => l.includes('Drawing'));

    expect(drawingLines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l).toMatch(/\\(pos|move)\(/);
    }

    const fullText = lines.join('\n');
    expect(fullText).toContain('LOT 1 OF 43');
    expect(fullText).toContain('LIVE');
    expect(fullText).toContain('BIDDING CLOSED');
    expect(fullText).toContain('SOLD');
  });

  test('BidCard component should render all bids with explicitly positioned lines', () => {
    const lines = buildBidCardLines(mockTimeline, DEFAULT_THEME_VERSION);

    for (const l of lines) {
      expect(l).toMatch(/\\(pos|move)\(/);
    }

    // Must contain starting price and all bids
    const fullText = lines.join('\n');
    expect(fullText).toContain('STARTING BID');
    expect(fullText).toContain('₹50');
    expect(fullText).toContain('CURRENT BID');
    expect(fullText).toContain('₹75');
    expect(fullText).toContain('ayan1294');
    expect(fullText).toContain('₹100');
    expect(fullText).toContain('winay');
    expect(fullText).toContain('₹500');
    expect(fullText).toContain('sarth');
    // bid deltas float up beside the amount
    expect(fullText).toContain('+₹25');
    expect(fullText).toContain('+₹400');
  });

  test('Countdown ring should stop at tl.close.t with explicitly positioned lines', () => {
    const lines = buildCountdownRingLines(mockTimeline, DEFAULT_THEME_VERSION);

    for (const l of lines) {
      expect(l).toMatch(/\\(pos|move)\(/);
    }

    // Digit countdown must not exceed tl.close.t (22.0)
    const digitLines = lines.filter((l) => l.includes('HUD') && l.includes('s'));
    for (const d of digitLines) {
      const match = d.match(/Dialogue: \d+,(\d+:\d+:\d+\.\d+),(\d+:\d+:\d+\.\d+)/);
      if (match) {
        const startParts = match[1].split(':');
        const startSec =
          parseFloat(startParts[0]) * 3600 +
          parseFloat(startParts[1]) * 60 +
          parseFloat(startParts[2]);
        expect(startSec).toBeLessThanOrEqual(mockTimeline.close.t);
      }
    }
  });

  test('Finale component should position every element and centre the winner banner', () => {
    const lines = buildFinaleLines(mockTimeline, DEFAULT_THEME_VERSION);
    const drawingLines = lines.filter((l) => l.includes('Drawing'));

    // dim + 2 shockwaves + price (shadow, body) + winner glow + winner (shadow, body)
    expect(drawingLines.length).toBe(8);
    for (const l of lines) {
      expect(l).toMatch(/\\(pos|move)\(/);
    }

    const fullText = lines.join('\n').replace(/\{[^}]*\}/g, '');
    expect(fullText).toContain('SOLD!');
    expect(fullText).toContain('FOR ₹500');
    expect(fullText).toContain('WINNER: sarth');

    const winnerText = lines.find((l) => l.includes('sarth'));
    expect(winnerText).toContain('\\pos(360,');
    expect(winnerText).toContain('\\an5');
  });

  test('Captions component should separate words with non-breaking space \\h to prevent stroke overlap', () => {
    const timelineWithCaptions: ReelTimeline = {
      ...mockTimeline,
      captions: [
        {
          t0: 1.0,
          t1: 2.0,
          words: [
            { t0: 1.0, t1: 1.5, text: 'MAKE', kind: '' },
            { t0: 1.5, t1: 2.0, text: 'SURE', kind: '' },
          ],
        },
      ],
    };

    const lines = buildCaptionsLines(timelineWithCaptions, DEFAULT_THEME_VERSION);
    expect(lines.length).toBe(2);
    // Every dialogue line must contain ' \h ' between words
    for (const l of lines) {
      expect(l).toContain('\\h');
    }
  });
});
