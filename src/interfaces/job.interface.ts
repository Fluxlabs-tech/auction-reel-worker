export type JobStep =
  | 'WAITING'
  | 'FETCH_AUCTIONS'
  | 'BUILD_CLOCK'
  | 'PREPARE_LOTS'
  | 'CALIBRATE'
  | 'RENDER_LOTS'
  | 'FINALIZE'
  | 'DONE';

export type JobStatus =
  'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'DONE' | 'PARTIAL' | 'FAILED' | 'SKIPPED';

export interface ReadinessState {
  auctions_closed: boolean;
  playlist_final: boolean;
  checked_at: string;
  give_up_at?: string;
}

export interface ClockState {
  method: 'pdt' | 'last_modified';
  gcs_uri: string;
}

export interface LatencyState {
  seconds: number;
  matches: number;
  confidence: 'ok' | 'low';
  range?: [number, number];
}

export interface ThemePin {
  id: string;
  version: number;
}

export interface JobCounts {
  total: number;
  prepared: number;
  done: number;
  needs_review: number;
  failed: number;
  completed?: number;
  retrying?: number;
}

export interface JobTranscriptState {
  status: 'NOT_STARTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
  source?: string;
  storage_provider?: 'gcp' | 'aws';
  storage_uri?: string;
  gcs_prefix?: string;
  word_count?: number;
  error?: string;
  completed_at?: string;
}

export interface AuctionReelJob {
  stream_id: number;
  seller_id?: number | string;
  store_id?: number | string;
  seller_store_name?: string;
  title?: string;
  schema_version: number;
  step: JobStep;
  status: JobStatus;
  skip_reason?: string;
  next_run_at: number; // millisecond timestamp
  lease_until: number | null; // millisecond timestamp
  worker_id: string | null;
  attempts: Record<string, number>;
  last_error: string | null;
  readiness: ReadinessState;
  transcript?: JobTranscriptState;
  auction_data_present?: boolean;
  auction?: Record<string, any>;
  auction_bids?: any[];
  total_lots?: number;
  clock?: ClockState;
  latency?: LatencyState;
  theme?: ThemePin;
  counts: JobCounts;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}
