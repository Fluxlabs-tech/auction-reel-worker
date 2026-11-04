export interface TimelineMeta {
  stream_id: number;
  auction_id: string;
  lot_no: number;
  lot_total: number;
  store: string;
  starting_price: number;
  currency: string;
  latency_s: number;
}

export interface TimelineIntro {
  t0: number;
  t1: number;
}

export interface TimelineLive {
  t: number;
}

export interface TimelineBid {
  t: number;
  amount: number;
  bidder: string;
  burst: number;
}

export interface TimelineDeadlineSegment {
  t: number;
  ends: number;
}

export interface TimelineDeadline {
  ok: boolean;
  segments: TimelineDeadlineSegment[];
}

export interface TimelineClose {
  t: number;
}

export type TimelineResult =
  | { kind: 'sold'; t: number; amount: number; winner: string }
  | { kind: 'unsold'; t: number }
  | { kind: 'cancelled'; t: number };

export interface TimelineCue {
  id: string;
  t0: number;
  t1: number;
  amount?: number;
}

export type CaptionWordKind = '' | 'money' | 'key' | 'low_conf';

export interface TimelineCaptionWord {
  t0: number;
  t1: number;
  text: string;
  kind: CaptionWordKind;
}

export interface TimelineCaptionChunk {
  t0: number;
  t1: number;
  words: TimelineCaptionWord[];
}

export interface ReelTimeline {
  version: 1;
  meta: TimelineMeta;
  intro: TimelineIntro;
  live: TimelineLive;
  bids: TimelineBid[];
  deadline: TimelineDeadline;
  close: TimelineClose;
  result: TimelineResult;
  cues: TimelineCue[];
  captions: TimelineCaptionChunk[];
  end: number;
}
