import fs from 'fs';
import path from 'path';
import { AuctionReelJob } from '../../interfaces/job.interface';
import { AuctionReelLot, LotWindow } from '../../interfaces/lot.interface';
import { TranscriptWord, CleanedWord } from '../../interfaces/transcript.interface';
import { StreamAuctionItem } from '../external/shareLeaderboard';
import { HlsSegment } from '../media/parsePlaylist.service';
import { StreamClock } from '../media/buildStreamClock.service';
import { cutClipService } from '../media/cutClip.service';
import { probeDurationService } from '../media/probeDuration.service';
import { cleanWordsService } from '../timeline/cleanWords.service';
import { buildTimelineService } from '../timeline/buildTimeline.service';
import { loadThemeService } from '../render/loadTheme.service';
import { renderReelService } from '../render/renderReel.service';
import { uploadToStorageService } from '../storage/uploadToStorage.service';
import { DEFAULT_REEL_CONFIG } from '../../config/defaults';
import { env } from '../../config/env';

export interface SingleLotReelResult {
  reelUri: string;
  rawReelUri?: string;
  raw_reel?: string;
  clip?: string;
  thumbUri: string;
  duration?: number;
}

export const renderSingleLotReelService = async (
  job: AuctionReelJob,
  lot: AuctionReelLot,
  allWords: TranscriptWord[],
  clock: StreamClock,
  segs: HlsSegment[],
): Promise<SingleLotReelResult> => {
  let lotDir: string;
  let segmentsDir: string;
  let startedAt: string;
  let closedAt: string;
  let m0: number;
  let m1: number;
  let lotWindow: LotWindow;
  let clipPath: string;
  let probe: any;
  let clipDur: number | undefined;
  let lotWords: TranscriptWord[] = [];
  let cleanedWords: CleanedWord[] = [];
  let auctionItem: StreamAuctionItem;
  let timeline: any;
  let themeRes: any;
  let renderRes: any;
  let reelKey: string;
  let rawReelKey: string;
  let thumbKey: string;
  let reelUri: string;
  let rawReelUri: string;
  let thumbUri: string;
  let lotNumberStr: string;
  let jobAuction: any;
  let lotBids: any[];
  let startingPrice: number;
  let endsAt: string;
  let currency: string;
  let status: string;
  let closeReason: string;
  let closingRuleType: string;
  let closingRuleConfig: any;
  let extensionUsedMs: number;
  let winner: any;

  try {
    lotDir = path.join(
      env.SCRATCH_DIR,
      String(job.stream_id),
      `lot_${String(lot.lot_number).padStart(2, '0')}_${lot.id}`,
    );
    if (!fs.existsSync(lotDir)) {
      fs.mkdirSync(lotDir, { recursive: true });
    }

    segmentsDir = path.join(env.SCRATCH_DIR, String(job.stream_id), 'segments');

    startedAt = lot.summary?.started_at || lot.auction?.started_at || job.created_at;
    closedAt = lot.summary?.closed_at || lot.auction?.closed_at || startedAt;

    // 1. Calculate media window [m0, m1]
    m0 = Math.max(0, clock.toMedia(startedAt) - 10);
    m1 = Math.max(m0 + 15, clock.toMedia(closedAt) + 10);
    lotWindow = { m0, m1 };

    // 2. Cut clip for window
    clipPath = await cutClipService(segs, lotWindow, lotDir, segmentsDir);

    try {
      probe = await probeDurationService(clipPath);
      clipDur = probe.duration;
    } catch (_probeErr) {
      clipDur = m1 - m0;
    }

    // 3. Extract and align transcript words to clip-relative seconds
    for (const w of allWords) {
      if (w.start >= m0 && w.start <= m1) {
        lotWords.push({
          ...w,
          start: Math.max(0, w.start - m0),
          end: w.end !== undefined ? Math.max(0, w.end - m0) : undefined,
        });
      }
    }

    cleanedWords = cleanWordsService(lotWords, DEFAULT_REEL_CONFIG);

    // 4. Build timeline with bid card, cues, and winner
    jobAuction = (job.auction && job.auction[lot.id]) || {};
    lotBids =
      job.auction_bids && job.auction_bids.length > 0
        ? job.auction_bids.filter((b: any) => b.auction_id === lot.id)
        : lot.auction_bids || lot.auction?.bids || jobAuction.bids || [];

    startingPrice =
      lot.summary?.starting_price ?? jobAuction.starting_price ?? lot.auction?.starting_price ?? 0;
    startedAt =
      lot.summary?.started_at || jobAuction.started_at || lot.auction?.started_at || startedAt;
    closedAt = lot.summary?.closed_at || jobAuction.closed_at || lot.auction?.closed_at || closedAt;
    endsAt = jobAuction.ends_at || lot.auction?.ends_at || closedAt;
    currency = jobAuction.currency || lot.auction?.currency || 'INR';
    status = jobAuction.status || lot.auction?.status || 'closed';
    closeReason =
      lot.summary?.close_reason || jobAuction.close_reason || lot.auction?.close_reason || 'sold';
    closingRuleType =
      jobAuction.closing_rule_type || lot.auction?.closing_rule_type || 'time_bound';
    closingRuleConfig = jobAuction.closing_rule_config ||
      lot.auction?.closing_rule_config || { duration_seconds: 15 };
    extensionUsedMs = jobAuction.extension_used_ms || lot.auction?.extension_used_ms || 0;

    winner =
      lot.summary?.winner_display_name || lot.summary?.winning_amount
        ? {
            slot_rank: 1,
            display_name: lot.summary.winner_display_name || 'Winner',
            winning_amount: lot.summary.winning_amount || 0,
          }
        : jobAuction.winner || lot.auction?.winner || null;

    auctionItem = {
      auction_id: lot.id,
      product_id: lot.product_id || jobAuction.product_id || 0,
      status,
      close_reason: closeReason,
      starting_price: startingPrice,
      currency,
      closing_rule_type: closingRuleType,
      closing_rule_config: closingRuleConfig,
      started_at: startedAt,
      ends_at: endsAt,
      closed_at: closedAt,
      extension_used_ms: extensionUsedMs,
      winner_count: 1,
      bids: lotBids,
      winner,
    };

    timeline = buildTimelineService({
      auction: auctionItem,
      words: cleanedWords,
      clock,
      window: lotWindow,
      latency: job.latency || { seconds: 2.0, matches: 0, confidence: 'low' },
      lotNo: lot.lot_number,
      lotTotal: job.total_lots || 1,
      storeName: job.seller_store_name,
      clipDuration: clipDur,
      cfg: DEFAULT_REEL_CONFIG,
    });

    // 5. Load theme
    themeRes = await loadThemeService(lot.theme || { id: 'default', version: 1 });

    // 6. Render reel with ffmpeg child process
    renderRes = await renderReelService(clipPath, timeline, themeRes.theme, lotDir);

    // 7. Upload reel, raw reel, and thumbnail to configured bucket (GCP/AWS)
    lotNumberStr = String(lot.lot_number).padStart(2, '0');
    reelKey = `auction-reels/reels/${job.stream_id}/${lotNumberStr}_${lot.id}/reel.mp4`;
    rawReelKey = `auction-reels/reels/${job.stream_id}/${lotNumberStr}_${lot.id}/raw_reel.mp4`;
    thumbKey = `auction-reels/reels/${job.stream_id}/${lotNumberStr}_${lot.id}/thumb.jpg`;

    // Upload raw reel (uncropped/clean cut clip without HUD overlays)
    rawReelUri = await uploadToStorageService(rawReelKey, clipPath, {
      contentType: 'video/mp4',
    });

    // Upload final animated reel
    reelUri = await uploadToStorageService(reelKey, renderRes.reelPath, {
      contentType: 'video/mp4',
    });

    // Upload thumbnail
    thumbUri = await uploadToStorageService(thumbKey, renderRes.thumbPath, {
      contentType: 'image/jpeg',
    });

    return {
      reelUri,
      rawReelUri,
      raw_reel: rawReelUri,
      clip: rawReelUri,
      thumbUri,
      duration: clipDur,
    };
  } catch (error: any) {
    console.error(
      `[renderSingleLotReelService] Error rendering reel for lot ${lot.id} on stream ${job.stream_id}:`,
      error?.message || error,
    );
    throw error;
  }
};
