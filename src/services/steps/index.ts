import { AuctionReelJob, JobStep } from '../../interfaces/job.interface';
import { waitingStepService } from './waitingStep.service';
import { fetchAuctionsStepService } from './fetchAuctionsStep.service';
import { buildClockStepService } from './buildClockStep.service';
import { prepareLotsStepService } from './prepareLotsStep.service';
import { calibrateStepService } from './calibrateStep.service';
import { renderLotsStepService } from './renderLotsStep.service';
import { finalizeStepService } from './finalizeStep.service';

export * from './helpers';
export * from './waitingStep.service';
export * from './fetchAuctionsStep.service';
export * from './buildClockStep.service';
export * from './prepareLotsStep.service';
export * from './calibrateStep.service';
export * from './renderLotsStep.service';
export * from './finalizeStep.service';

export type StepHandler = (
  job: AuctionReelJob,
) => Promise<{ next: JobStep; patch?: Partial<AuctionReelJob> }>;

export const STEP_HANDLERS: Record<string, StepHandler> = {
  WAITING: waitingStepService,
  FETCH_AUCTIONS: fetchAuctionsStepService,
  BUILD_CLOCK: buildClockStepService,
  PREPARE_LOTS: prepareLotsStepService,
  CALIBRATE: calibrateStepService,
  RENDER_LOTS: renderLotsStepService,
  FINALIZE: finalizeStepService,
};
