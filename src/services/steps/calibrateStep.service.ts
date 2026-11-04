import { AuctionReelJob, JobStep } from '../../interfaces/job.interface';
import { AuctionReelLot } from '../../interfaces/lot.interface';
import { AuctionReelLotModel } from '../../models/auctionReelLot.model';
import { ReelConfigModel } from '../../models/reelConfig.model';
import { downloadGcsObjectService } from '../external/downloadGcsObject.service';
import { calibrateLatencyService, LotCalibrationInput } from '../timeline/calibrateLatency.service';
import { getStreamGcsPrefix, getLotGcsPrefix } from './helpers';

const reconstructClock = (stored: any) => {
  const groups = stored.groups;
  return {
    method: stored.method,
    groups,
    toMedia: (wallTime: string | number | Date): number => {
      const wallMs = typeof wallTime === 'number' ? wallTime : new Date(wallTime).getTime();
      let selectedGroup = groups[0];
      for (const g of groups) {
        const estSec = (wallMs - g.w0) / 1000;
        if (estSec >= g.mediaStartMin && estSec <= g.mediaStartMax) {
          selectedGroup = g;
          break;
        }
      }
      return (wallMs - selectedGroup.w0) / 1000;
    },
    toWall: (mediaSec: number, groupIndex: number = 0): Date => {
      const g = groups.find((grp: any) => grp.group === groupIndex) || groups[0];
      return new Date(g.w0 + mediaSec * 1000);
    },
  };
};

export const calibrateStepService = async (
  job: AuctionReelJob,
): Promise<{ next: JobStep; patch: Partial<AuctionReelJob> }> => {
  let streamPrefix: string;
  let clockData: any;
  let clock: any;
  let cfg: any;
  let preparedLots: AuctionReelLot[];
  let inputs: LotCalibrationInput[] = [];
  let calibration: ReturnType<typeof calibrateLatencyService>;

  try {
    streamPrefix = getStreamGcsPrefix(job.stream_id, job.created_at);
    clockData = await downloadGcsObjectService(`${streamPrefix}clock.json`);
    clock = reconstructClock(clockData.clock);
    cfg = await ReelConfigModel.getCurrentConfig();

    preparedLots = await AuctionReelLotModel.listByStatus(job.stream_id, ['PREPARED']);

    for (const lot of preparedLots) {
      if (!lot.window) continue;
      const auctionUri =
        lot.artifacts.auction_json ||
        `${getLotGcsPrefix(job.stream_id, lot.lot_number, lot.id, job.created_at)}auction.json`;
      const wordsUri =
        lot.artifacts.words ||
        `${getLotGcsPrefix(job.stream_id, lot.lot_number, lot.id, job.created_at)}words.json`;

      const auctionData = await downloadGcsObjectService(auctionUri);
      const wordsData = await downloadGcsObjectService(wordsUri);

      inputs.push({
        auction: auctionData,
        words: wordsData,
        window: lot.window,
      });
    }

    calibration = calibrateLatencyService(inputs, clock, cfg.latency, cfg.anchors);

    return {
      next: 'RENDER_LOTS',
      patch: {
        latency: {
          seconds: calibration.L,
          matches: calibration.matches,
          confidence: calibration.confidence,
          range: calibration.range,
        },
        updated_at: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    console.error(
      '[calibrateStepService] Error calibrating stream latency:',
      error?.message || error,
      {
        streamId: job.stream_id,
      },
    );
    throw error;
  }
};
