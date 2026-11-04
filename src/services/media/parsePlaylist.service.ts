export interface HlsSegment {
  key: string;
  dur: number;
  media_start: number;
  group: number;
  pdt: Date | null;
}

export const parsePlaylistService = (m3u8Text: string, keyPrefix?: string): HlsSegment[] => {
  let segs: HlsSegment[] = [];
  let media: number = 0;
  let group: number = 0;
  let pdt: Date | null = null;
  let currentDur: number = 0;
  let lines: string[];
  let line: string;
  let trimmed: string;
  let segKey: string;

  try {
    lines = m3u8Text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      line = lines[i];
      trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      if (trimmed.startsWith('#EXT-X-DISCONTINUITY')) {
        group++;
        continue;
      }

      if (trimmed.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
        const val = trimmed.replace('#EXT-X-PROGRAM-DATE-TIME:', '').trim();
        pdt = new Date(val);
        continue;
      }

      if (trimmed.startsWith('#EXTINF:')) {
        const val = trimmed.replace('#EXTINF:', '').split(',')[0].trim();
        currentDur = parseFloat(val) || 0;
        continue;
      }

      if (!trimmed.startsWith('#') && (trimmed.endsWith('.ts') || trimmed.includes('.ts?'))) {
        segKey =
          keyPrefix && !trimmed.startsWith('streams/') && !trimmed.startsWith(keyPrefix)
            ? `${keyPrefix.replace(/\/$/, '')}/${trimmed}`
            : trimmed;

        segs.push({
          key: segKey,
          dur: currentDur,
          media_start: media,
          group,
          pdt,
        });
        media += currentDur;
        pdt = null;
        currentDur = 0;
      }
    }

    return segs;
  } catch (error: any) {
    console.error('[parsePlaylistService] Error parsing HLS playlist:', error?.message || error);
    throw error;
  }
};
