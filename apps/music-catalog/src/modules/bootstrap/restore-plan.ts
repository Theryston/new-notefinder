import type { CatalogDataset } from '@notefinder/contracts';
import type { BootstrapState } from './bootstrap.repository.js';

/**
 * What a start of the restore has to do. `fresh` is an empty database,
 * `redo` an interrupted restore (or a dataset the recorded one was not built
 * from), `skip` a restore that is already done, and `dataset-changed` a
 * catalog that became `restored` or further with another dataset: switching
 * datasets is never automatic (it would silently re-download gigabytes), so
 * the restore refuses and points at the reset procedure instead.
 */
export type RestorePlan = 'fresh' | 'redo' | 'skip' | 'dataset-changed';

export const planRestore = (
  state: BootstrapState | undefined,
  dataset: CatalogDataset,
): RestorePlan => {
  if (state === undefined) {
    return 'fresh';
  }
  if (state.phase === 'restoring') {
    return 'redo';
  }
  return state.dataset === dataset ? 'skip' : 'dataset-changed';
};
