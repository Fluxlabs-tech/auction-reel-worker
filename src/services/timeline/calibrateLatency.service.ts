import { StreamClock } from '../media/buildStreamClock.service';
import { ReelConfig } from '../../interfaces/theme.interface';
import { LotWindow } from '../../interfaces/lot.interface';
import { TranscriptWord } from '../../interfaces/transcript.interface';
import { StreamAuctionItem } from '../external/getStreamAuctionTimeline.service';
import { parseAmountsService } from './parseAmounts.service';

export interface LotCalibrationInput {
  auction: StreamAuctionItem;
  words: TranscriptWord[];
  window: LotWindow;
}

export interface CalibrationResult {
  L: number;
  matches: number;
  confidence: 'ok' | 'low';
  range: [number, number];
}

interface Observation {
  t: number;
  m0: number;
  candidatesWallMs: number[];
  weight: number;
  positiveOnly: boolean;
}

const findFirstAnchorInWords = (words: TranscriptWord[], patterns: string[][]): number | null => {
  const normWords = words.map((w) => w.word.toLowerCase().replace(/[^a-z0-9]/g, ''));

  for (const pat of patterns) {
    const patLen = pat.length;
    for (let i = 0; i <= normWords.length - patLen; i++) {
      let matches = true;
      for (let j = 0; j < patLen; j++) {
        if (normWords[i + j] !== pat[j].toLowerCase()) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return words[i].start;
      }
    }
  }

  return null;
};

export const calibrateLatencyService = (
  inputs: LotCalibrationInput[],
  clock: StreamClock,
  params: ReelConfig['latency'],
  anchorsCfg?: ReelConfig['anchors'],
): CalibrationResult => {
  let observations: Observation[] = [];
  let grid: number[] = [];
  let bestScore: number = -Infinity;
  let tiedL: number[] = [];
  let chosenL: number;
  let confidence: 'ok' | 'low';

  try {
    for (const input of inputs) {
      const { auction, words, window } = input;
      const m0 = window.m0;

      // Pool of events: bids + starting bid
      const events: Array<{ wallMs: number; val: number }> = [];
      const startPrice = parseFloat(String(auction.starting_price)) || 0;
      events.push({
        wallMs: new Date(auction.started_at).getTime(),
        val: startPrice,
      });

      for (const b of auction.bids || []) {
        events.push({
          wallMs: new Date(b.submitted_at).getTime(),
          val: parseFloat(String(b.amount)) || 0,
        });
      }

      // Spoken amounts observations
      const amounts = parseAmountsService(words);
      for (const amt of amounts) {
        const matchingEvents = events
          .filter((e) => Math.abs(e.val - amt.value) < 0.01)
          .map((e) => e.wallMs);

        if (matchingEvents.length > 0) {
          observations.push({
            t: amt.t,
            m0,
            candidatesWallMs: matchingEvents,
            weight: 1.0,
            positiveOnly: false,
          });
        }
      }

      // Anchor cues
      if (anchorsCfg) {
        if (anchorsCfg.start) {
          const tStart = findFirstAnchorInWords(words, anchorsCfg.start);
          if (tStart !== null) {
            observations.push({
              t: tStart,
              m0,
              candidatesWallMs: [new Date(auction.started_at).getTime()],
              weight: params.anchor_weight || 0.5,
              positiveOnly: true,
            });
          }
        }
        if (anchorsCfg.sold) {
          const tSold = findFirstAnchorInWords(words, anchorsCfg.sold);
          if (tSold !== null) {
            observations.push({
              t: tSold,
              m0,
              candidatesWallMs: [new Date(auction.closed_at).getTime()],
              weight: params.anchor_weight || 0.5,
              positiveOnly: true,
            });
          }
        }
      }
    }

    // Generate grid: [grid_min_s .. grid_max_s step grid_step_s]
    for (let l = params.grid_min_s; l <= params.grid_max_s + 1e-6; l += params.grid_step_s) {
      grid.push(Math.round(l * 1000) / 1000);
    }

    // Grid search scoring
    const scores: Record<number, number> = {};
    for (const L of grid) {
      let totalScore = 0;

      for (const obs of observations) {
        // c(E, L) = clock.toMedia(E) - m0 + L
        let hasReactionWindowMatch = false;
        let allBeforeBid = true;

        for (const wallMs of obs.candidatesWallMs) {
          const c = clock.toMedia(wallMs) - obs.m0 + L;
          const diff = obs.t - c;

          if (diff >= params.react_min_s && diff <= params.react_max_s) {
            hasReactionWindowMatch = true;
          }
          if (diff >= 0) {
            allBeforeBid = false;
          }
        }

        if (hasReactionWindowMatch) {
          totalScore += obs.weight * 1;
        } else if (!obs.positiveOnly && allBeforeBid) {
          totalScore += obs.weight * -1;
        }
      }

      scores[L] = totalScore;
      if (totalScore > bestScore) {
        bestScore = totalScore;
      }
    }

    // Filter tied L values with maximum score
    tiedL = grid.filter((L) => Math.abs((scores[L] || 0) - bestScore) < 1e-6);

    if (tiedL.length === 0) {
      chosenL = params.prior_s;
    } else {
      // Tie-break toward prior_s
      chosenL = tiedL.reduce((prev, curr) =>
        Math.abs(curr - params.prior_s) < Math.abs(prev - params.prior_s) ? curr : prev,
      );
    }

    confidence = bestScore >= params.min_matches ? 'ok' : 'low';
    if (bestScore < params.min_matches) {
      chosenL = params.prior_s;
    }

    return {
      L: chosenL,
      matches: Math.max(0, bestScore),
      confidence,
      range: tiedL.length > 0 ? [Math.min(...tiedL), Math.max(...tiedL)] : [chosenL, chosenL],
    };
  } catch (error: any) {
    console.error('[calibrateLatencyService] Error calibrating latency:', error?.message || error);
    return {
      L: params.prior_s,
      matches: 0,
      confidence: 'low',
      range: [params.prior_s, params.prior_s],
    };
  }
};
