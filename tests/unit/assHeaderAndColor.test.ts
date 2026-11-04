import {
  parseColorToRgba,
  assColor,
  assStyleColor,
  assInlineColor,
  buildAssHeader,
} from '../../src/render/ass/header';
import { DEFAULT_THEME_VERSION } from '../../src/config/defaults';
import { buildFilterGraphService } from '../../src/services/render/buildFilterGraph.service';

describe('ASS Header and Color Parsing', () => {
  describe('parseColorToRgba', () => {
    it('should parse 6-digit hex color into BGR with full opacity (alpha = 0)', () => {
      const parsed = parseColorToRgba('#FFD60A');
      expect(parsed.r).toBe(255);
      expect(parsed.g).toBe(214);
      expect(parsed.b).toBe(10);
      expect(parsed.a).toBe(0);
      expect(parsed.rHex).toBe('FF');
      expect(parsed.gHex).toBe('D6');
      expect(parsed.bHex).toBe('0A');
      expect(parsed.aHex).toBe('00');
    });

    it('should parse rgba string and invert alpha (0 = opaque, 255 = transparent)', () => {
      // 0.77 opacity -> 23% transparency -> ~59 (0x3B)
      const parsed = parseColorToRgba('rgba(14,14,22,0.77)');
      expect(parsed.r).toBe(14);
      expect(parsed.g).toBe(14);
      expect(parsed.b).toBe(22);
      expect(parsed.a).toBe(59);
      expect(parsed.rHex).toBe('0E');
      expect(parsed.gHex).toBe('0E');
      expect(parsed.bHex).toBe('16');
      expect(parsed.aHex).toBe('3B');
    });

    it('should respect explicit alpha override when provided', () => {
      const parsed = parseColorToRgba('#FFFFFF', 120);
      expect(parsed.a).toBe(120);
      expect(parsed.aHex).toBe('78');
    });
  });

  describe('assColor', () => {
    it('should return 6-character BGR tag for opaque colors', () => {
      expect(assColor('#FFD60A')).toBe('&H0AD6FF&');
      expect(assColor('#FF2D55')).toBe('&H552DFF&');
      expect(assColor('#FFFFFF')).toBe('&HFFFFFF&');
    });

    it('should append \\1a transparency tag for colors with alpha', () => {
      expect(assColor('rgba(14,14,22,0.77)')).toBe('&H160E0E&\\1a&H3B&');
    });
  });

  describe('assStyleColor', () => {
    it('should return &HAABBGGRR format for V4+ Styles', () => {
      expect(assStyleColor('#FFFFFF')).toBe('&H00FFFFFF');
      expect(assStyleColor('#16161D')).toBe('&H001D1616');
      expect(assStyleColor('#16161D', 120)).toBe('&H781D1616');
    });
  });

  describe('assInlineColor', () => {
    it('should return &HBBGGRR& format for inline \\c tags', () => {
      expect(assInlineColor('#FFD60A')).toBe('&H0AD6FF&');
      expect(assInlineColor('#4ADE80')).toBe('&H80DE4A&');
      expect(assInlineColor('#5EEAD4')).toBe('&HD4EA5E&');
    });
  });

  describe('buildAssHeader', () => {
    it('should build a valid ASS header with Poppins ExtraBold font styles', () => {
      const header = buildAssHeader(DEFAULT_THEME_VERSION, 'Test Header');
      expect(header).toContain('Title: Test Header');
      expect(header).toContain('PlayResX: 720');
      expect(header).toContain('PlayResY: 1280');
      expect(header).toContain('Style: HUD,Poppins ExtraBold,22');
      expect(header).toContain('Style: BidCard,Poppins ExtraBold,44');
      expect(header).toContain('Style: Captions,Poppins ExtraBold,58');
      expect(header).toContain('Style: Finale,Poppins ExtraBold,72');
    });
  });

  describe('buildFilterGraphService fontsdir fallback', () => {
    it('should include fontsdir pointing to fonts folder when present', () => {
      const mockTl: any = {
        meta: { lot_no: 1, lot_total: 10 },
        live: { t: 2 },
        close: { t: 20 },
        result: { kind: 'sold', t: 21 },
        cues: [],
      };
      const res = buildFilterGraphService(
        mockTl,
        { ...DEFAULT_THEME_VERSION, basePath: '/non-existent-theme-dir' },
        '/tmp/hud.ass',
        '/tmp/captions.ass',
      );

      // Should fallback to local ./fonts directory
      expect(res.graph).toContain(':fontsdir=');
      expect(res.graph).toContain('/fonts');
    });
  });
});
