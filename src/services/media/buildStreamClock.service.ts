import pLimit from 'p-limit';
import { HlsSegment } from './parsePlaylist.service';
import { headS3ObjectService } from '../external';

export interface ClockGroupAnchor {
  group: number;
  w0: number; // millisecond wall time at media time 0 for this group
  mediaStartMin: number;
  mediaStartMax: number;
}

export interface StreamClock {
  method: 'pdt' | 'last_modified';
  groups: ClockGroupAnchor[];
  toMedia: (wallTime: string | number | Date) => number;
  toWall: (mediaSeconds: number, groupIndex?: number) => Date;
}

export const median = (numbers: number[]): number => {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const buildStreamClockService = async (
  streamId: number,
  segs: HlsSegment[],
  customHeadFn?: (key: string) => Promise<Date>,
): Promise<StreamClock> => {
  let hasAllPdt: boolean;
  let groupsMap: Map<number, HlsSegment[]> = new Map();
  let clockGroups: ClockGroupAnchor[] = [];
  let limit: any;
  let headFn: (key: string) => Promise<Date>;

  try {
    if (segs.length === 0) {
      throw new Error(`Cannot build stream clock: segment list is empty for stream ${streamId}`);
    }

    hasAllPdt = segs.every((s) => s.pdt !== null);

    // Group segments by discontinuity index
    for (const seg of segs) {
      if (!groupsMap.has(seg.group)) {
        groupsMap.set(seg.group, []);
      }
      groupsMap.get(seg.group)!.push(seg);
    }

    if (hasAllPdt) {
      // PDT path
      for (const [groupNum, groupSegs] of groupsMap.entries()) {
        const first = groupSegs[0];
        const w0 = first.pdt!.getTime() - first.media_start * 1000;
        const mediaStartMin = groupSegs[0].media_start;
        const mediaStartMax =
          groupSegs[groupSegs.length - 1].media_start + groupSegs[groupSegs.length - 1].dur;

        clockGroups.push({
          group: groupNum,
          w0,
          mediaStartMin,
          mediaStartMax,
        });
      }

      return createStreamClockObject('pdt', clockGroups);
    }

    // Last-Modified path (read from S3 with concurrency limit 32)
    limit = pLimit(32);
    headFn =
      customHeadFn ||
      (async (k: string) => {
        const h = await headS3ObjectService(k);
        return h.LastModified || new Date();
      });

    for (const [groupNum, groupSegs] of groupsMap.entries()) {
      const offsets: number[] = await Promise.all(
        groupSegs.map((s) =>
          limit(async () => {
            const lastMod = await headFn(s.key);
            // offset = LastModified - (media_start + dur)
            const segEndMs = (s.media_start + s.dur) * 1000;
            return lastMod.getTime() - segEndMs;
          }),
        ),
      );

      const w0 = median(offsets);
      const mediaStartMin = groupSegs[0].media_start;
      const mediaStartMax =
        groupSegs[groupSegs.length - 1].media_start + groupSegs[groupSegs.length - 1].dur;

      clockGroups.push({
        group: groupNum,
        w0,
        mediaStartMin,
        mediaStartMax,
      });
    }

    return createStreamClockObject('last_modified', clockGroups);
  } catch (error: any) {
    console.error(
      '[buildStreamClockService] Error building stream clock:',
      error?.message || error,
      {
        streamId,
      },
    );
    throw error;
  }
};

const createStreamClockObject = (
  method: 'pdt' | 'last_modified',
  groups: ClockGroupAnchor[],
): StreamClock => {
  return {
    method,
    groups,
    toMedia: (wallTime: string | number | Date): number => {
      const wallMs = typeof wallTime === 'number' ? wallTime : new Date(wallTime).getTime();

      // Find best matching group or default to first group
      let selectedGroup = groups[0];
      for (const g of groups) {
        const estMediaSec = (wallMs - g.w0) / 1000;
        if (estMediaSec >= g.mediaStartMin && estMediaSec <= g.mediaStartMax) {
          selectedGroup = g;
          break;
        }
      }

      return (wallMs - selectedGroup.w0) / 1000;
    },
    toWall: (mediaSeconds: number, groupIndex: number = 0): Date => {
      const g = groups.find((grp) => grp.group === groupIndex) || groups[0];
      const wallMs = g.w0 + mediaSeconds * 1000;
      return new Date(wallMs);
    },
  };
};
