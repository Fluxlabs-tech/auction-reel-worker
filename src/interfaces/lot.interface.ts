import { ThemePin } from './job.interface';

export type LotStatus =
  | 'PENDING'
  | 'PREPARED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'DONE'
  | 'NEEDS_REVIEW'
  | 'FAILED'
  | 'SKIPPED'
  | 'RETRYABLE';

export interface LotAttempts {
  prepare: number;
  render: number;
}

export interface LotSummary {
  started_at: string;
  closed_at: string;
  bid_count: number;
  starting_price?: string | number;
  winning_amount?: string | number | null;
  winner_display_name?: string | null;
  close_reason?: string;
}

export interface LotWindow {
  m0: number; // media seconds start
  m1: number; // media seconds end
}

export interface LotArtifacts {
  auction_json?: string;
  clip?: string;
  raw_reel?: string;
  rawReelUri?: string;
  reelUri?: string;
  thumbUri?: string;
  words?: string;
  timeline?: string;
  reel?: string;
  thumbnail?: string;
  duration?: number;
}

export interface AuctionReelLot {
  id: string; // auction_id
  stream_id?: number;
  lot_number: number;
  product_id: number;
  status: LotStatus;
  retry_count?: number;
  max_retries?: number;
  attempts: LotAttempts;
  last_error: string | null;
  theme: ThemePin;
  renderer_version?: string;
  summary: LotSummary;
  auction?: Record<string, any>;
  auction_bids?: any[];
  window?: LotWindow;
  flags: string[];
  artifacts: LotArtifacts;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
}
