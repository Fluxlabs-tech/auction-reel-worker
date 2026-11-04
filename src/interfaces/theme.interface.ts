export interface ThemeColors {
  live: string;
  accent: string;
  bid: string;
  key: string;
  winner: string;
  warn: string;
  ink: string;
  glass: string;
}

export interface ThemeFonts {
  heavy: string;
  bold: string;
}

export interface ThemeTokens {
  colors: ThemeColors;
  radius: number;
  fonts: ThemeFonts;
}

export interface ThemeCanvas {
  w: number;
  h: number;
  fps: number;
}

export interface ThemeIntroComponent {
  enabled: boolean;
  y: number;
  title: string;
  subtitle: string;
}

export interface ThemeHudComponent {
  enabled: boolean;
  y: number;
  lot_label: string;
}

export interface ThemeBidCardComponent {
  enabled: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  show_bidder: boolean;
  new_bid_tag: string;
}

export interface ThemeRingComponent {
  enabled: boolean;
  cx: number;
  cy: number;
  r: number;
  reset_chip: string;
}

export interface ThemeChipsComponent {
  enabled: boolean;
  x: number;
  y: number[];
  max_on_screen: number;
}

export interface ThemeStickersComponent {
  enabled: boolean;
  y: number;
}

export interface ThemeBurstsComponent {
  live: string;
  close: string;
}

export interface ThemeFinaleComponent {
  stamp: string;
  price: string;
  winner: string;
  confetti: string;
  unsold: string;
  cancelled: string;
}

export interface ThemeCaptionsComponent {
  enabled: boolean;
  y: number;
  size: number;
  stroke: number;
  max_words: number;
  max_chars: number;
  uppercase: boolean;
}

export interface ThemeComponents {
  intro: ThemeIntroComponent;
  hud: ThemeHudComponent;
  bid_card: ThemeBidCardComponent;
  ring: ThemeRingComponent;
  chips: ThemeChipsComponent;
  stickers: ThemeStickersComponent;
  bursts: ThemeBurstsComponent;
  finale: ThemeFinaleComponent;
  captions: ThemeCaptionsComponent;
}

export interface ThemeAssets {
  icons: Record<string, string>;
  anim: Record<string, string>;
  sfx: Record<string, string | null>;
}

export interface ThemeCueText {
  icon?: string;
  text?: string;
  style?: string;
  line1?: string;
  line2?: string;
}

export interface ReelThemeVersion {
  min_renderer_version: string;
  canvas: ThemeCanvas;
  tokens: ThemeTokens;
  components: ThemeComponents;
  assets: ThemeAssets;
  cue_texts: Record<string, ThemeCueText>;
  basePath?: string; // local cache folder path
}

export interface ReelThemeDoc {
  name: string;
  status: 'active' | 'draft' | 'archived';
  current_version: number;
  weight: number;
  applies_to: {
    store_ids: (string | number)[];
    categories: string[];
  };
}

export interface ReelConfig {
  window: {
    pre_roll_s: number;
    post_roll_min_s: number;
    post_roll_max_s: number;
    neighbour_gap_s: number;
  };
  latency: {
    grid_min_s: number;
    grid_max_s: number;
    grid_step_s: number;
    prior_s: number;
    react_min_s: number;
    react_max_s: number;
    min_matches: number;
    anchor_weight: number;
  };
  bids: {
    coalesce_s: number;
  };
  cues: Array<{
    id: string;
    patterns: string[][];
    duration_s: number;
    capture_amount_within?: number;
  }>;
  anchors: {
    start: string[][];
    sold: string[][];
  };
  keywords: string[];
  asr_fixes: Record<string, string>;
}
