import type {
  BootstrapPhase,
  CatalogDataset,
  ReplicationStallReason,
} from '@notefinder/contracts';
import type { ReimportState } from './reimport-state.repository.js';

/**
 * Which process asks: the mbslave container owns the parallel restore (it
 * has the binary), the worker owns everything after it (it has the
 * Meilisearch write key).
 */
export type ReimportRole = 'restore-container' | 'worker';

export type ReimportSituation = {
  role: ReimportRole;
  dataset: CatalogDataset;
  bootstrapPhase: BootstrapPhase;
  stallReason: ReplicationStallReason | undefined;
  /** The mbslave release that saw the stall, when recorded. */
  stallMbslaveRef: string | null | undefined;
  /** The mbslave release running here, when known. */
  currentMbslaveRef: string | undefined;
  reimport?: ReimportState;
};

/**
 * What the process does next. `disabled` is anything but `full` (the seed
 * writes no replication data, so no schema change can stall it); `idle`
 * leaves the serving copy alone; `waiting-compatible` holds the stall for
 * the bumped mbslave image the yearly procedure deploys.
 */
export type ReimportDecision =
  | 'disabled'
  | 'idle'
  | 'waiting-compatible'
  | 'start-restore'
  | 'continue-restore'
  | 'wait-restore'
  | 'run-indexing'
  | 'run-switch';

/** The release marker missing from an image built before it existed. */
export const UNKNOWN_MBSLAVE_REF = 'unknown';

const isCompatibleMbslave = (
  current: string | undefined,
  stalled: string | null | undefined,
): boolean =>
  current !== undefined &&
  current !== UNKNOWN_MBSLAVE_REF &&
  current !== stalled;

export const planReimport = (
  situation: ReimportSituation,
): ReimportDecision => {
  if (situation.dataset !== 'full') {
    return 'disabled';
  }
  if (situation.bootstrapPhase !== 'ready') {
    return 'idle';
  }
  const { reimport } = situation;
  if (reimport !== undefined) {
    return planRunning(situation.role, reimport);
  }
  if (situation.stallReason !== 'schema-change') {
    return 'idle';
  }
  if (
    !isCompatibleMbslave(situation.currentMbslaveRef, situation.stallMbslaveRef)
  ) {
    return 'waiting-compatible';
  }
  return situation.role === 'restore-container' ? 'start-restore' : 'idle';
};

// A reimport already recorded resumes where it stands: the container owns
// the parallel restore, the worker everything after it. `switched` and
// anything unreadable are steady state.
const planRunning = (
  role: ReimportRole,
  reimport: ReimportState,
): ReimportDecision => {
  if (reimport.phase === 'restoring') {
    return role === 'restore-container' ? 'continue-restore' : 'wait-restore';
  }
  if (role !== 'worker') {
    return 'idle';
  }
  if (reimport.phase === 'indexing') {
    return 'run-indexing';
  }
  if (reimport.phase === 'switching') {
    return 'run-switch';
  }
  return 'idle';
};
