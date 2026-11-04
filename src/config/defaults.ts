import { ReelConfig, ReelThemeVersion } from '../interfaces/theme.interface';

export const DISCOVERY_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const WORKER_TICK_INTERVAL_MS = 5 * 1000; // 5 seconds
export const DEFAULT_CRON_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_MAX_JOB_LIMIT = 2;
export const DEFAULT_LOT_MAX_RETRIES = 3;

export const DEFAULT_LEASE_MS = 15 * 60 * 1000; // 15 minutes
export const LEASE_RENEW_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const WAITING_NOT_READY_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes
export const LOT_RETRY_BACKOFF_MS = 2 * 60 * 1000; // 2 minutes
export const GIVE_UP_AFTER_MS = 60 * 60 * 1000; // 1 hour

export const MAX_STEP_ATTEMPTS: Record<string, number> = {
  WAITING: 9999,
  FETCH_AUCTIONS: 5,
  BUILD_CLOCK: 5,
  PREPARE_LOTS: 3,
  CALIBRATE: 3,
  RENDER_LOTS: 3,
  FINALIZE: 3,
};

export const MAX_LOT_ATTEMPTS = 3;

export const DEFAULT_REEL_CONFIG: ReelConfig = {
  window: {
    pre_roll_s: 10,
    post_roll_min_s: 10,
    post_roll_max_s: 20,
    neighbour_gap_s: 2,
  },
  latency: {
    grid_min_s: 0,
    grid_max_s: 8,
    grid_step_s: 0.25,
    prior_s: 2.0,
    react_min_s: 0.3,
    react_max_s: 8,
    min_matches: 2,
    anchor_weight: 0.5,
  },
  bids: {
    coalesce_s: 0.4,
  },
  cues: [
    {
      id: 'first_item',
      patterns: [
        ['first', 'article'],
        ['first', 'item'],
        ['first', 'product'],
        ['pehla', 'item'],
      ],
      duration_s: 0,
    },
    {
      id: 'final_deal',
      patterns: [['final', 'deal']],
      duration_s: 2.4,
    },
    {
      id: 'decide_price',
      patterns: [
        ['no', 'price'],
        ['decide', 'your', 'number'],
        ['aap', 'decide'],
      ],
      duration_s: 4.8,
    },
    {
      id: 'cod',
      patterns: [['cod'], ['cash', 'on', 'delivery']],
      duration_s: 8.0,
      capture_amount_within: 6,
    },
    {
      id: 'free_shipping',
      patterns: [
        ['free', 'shipping'],
        ['free', 'delivery'],
      ],
      duration_s: 4.5,
    },
    {
      id: 'authentic',
      patterns: [['authentic'], ['genuine'], ['original', 'product']],
      duration_s: 6.5,
    },
  ],
  anchors: {
    start: [['started'], ['shuru', 'ho', 'gaya'], ['bid', 'is', 'live']],
    sold: [['sold'], ['bik', 'gaya']],
  },
  keywords: ['cod', 'free', 'shipping', 'authentic', 'genuine', 'sold'],
  asr_fixes: {
    meters: 'me is',
  },
};

export const DEFAULT_THEME_VERSION: ReelThemeVersion = {
  min_renderer_version: '1.0.0',
  canvas: { w: 720, h: 1280, fps: 30 },
  tokens: {
    colors: {
      live: '#FF2D55',
      accent: '#FFD60A',
      bid: '#4ADE80',
      key: '#5EEAD4',
      winner: '#8B5CF6',
      warn: '#FBBF24',
      ink: '#16161D',
      glass: 'rgba(14,14,22,0.77)',
    },
    radius: 24,
    fonts: {
      heavy: 'fonts/Poppins-ExtraBold.ttf',
      bold: 'fonts/Poppins-Bold.ttf',
    },
  },
  components: {
    intro: {
      enabled: true,
      y: 128,
      title: '{lot_ordinal} ITEM UP!',
      subtitle: 'Starting bid {starting_price}',
    },
    hud: {
      enabled: true,
      y: 48,
      lot_label: 'LOT {lot_no} OF {lot_total}',
    },
    bid_card: {
      enabled: true,
      x: 28,
      y: 108,
      w: 300,
      h: 150,
      show_bidder: true,
      new_bid_tag: 'NEW BID!',
    },
    ring: {
      enabled: true,
      cx: 634,
      cy: 166,
      r: 58,
      reset_chip: 'RESET TO {window}s',
    },
    chips: {
      enabled: true,
      x: 28,
      y: [280, 346],
      max_on_screen: 2,
    },
    stickers: {
      enabled: true,
      y: 590,
    },
    bursts: {
      live: 'BIDDING IS LIVE!',
      close: "TIME'S UP!",
    },
    finale: {
      stamp: 'SOLD!',
      price: 'FOR {amount}',
      winner: 'WINNER: {winner}',
      confetti: 'anim/confetti.webm',
      unsold: 'UNSOLD',
      cancelled: 'AUCTION CANCELLED',
    },
    captions: {
      enabled: true,
      y: 1168,
      size: 58,
      stroke: 6,
      max_words: 4,
      max_chars: 20,
      uppercase: true,
    },
  },
  assets: {
    icons: {
      hammer: 'icons/hammer.png',
      fire: 'icons/fire.png',
      cash: 'icons/cash.png',
      truck: 'icons/truck.png',
      check: 'icons/check.png',
      party: 'icons/party.png',
      timer: 'icons/timer.png',
      tag: 'icons/tag.png',
      think: 'icons/think.png',
    },
    anim: {
      confetti: 'anim/confetti.webm',
      shockwave: 'anim/shockwave.webm',
    },
    sfx: {
      bid: null,
      tick: null,
      sold: null,
    },
  },
  cue_texts: {
    cod: { icon: 'cash', text: 'COD available' },
    free_shipping: { icon: 'truck', text: 'FREE shipping on all orders' },
    authentic: { icon: 'check', text: '100% genuine · from manufacturer' },
    decide_price: {
      style: 'sticker',
      line1: 'NO FIXED PRICE',
      line2: 'YOU DECIDE!',
      icon: 'cash',
    },
    final_deal: {
      style: 'sticker',
      line1: "LET'S SEE…",
      line2: "WHAT'S THE FINAL DEAL?",
      icon: 'think',
    },
  },
};
