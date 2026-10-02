import type { Database } from './database/database.js';
import type { Logger } from './logger.js';
import type { CutoverWatcher } from './modules/bootstrap/bootstrap.service.js';
import type { ReimportState } from './modules/reimport/reimport-state.repository.js';

export type CutoverWatcherOptions = {
  /** The flip record, read from whichever copy this process serves. */
  readState: () => Promise<ReimportState | undefined>;
  /** Opens the database the flip points at. */
  openDatabase: (url: string) => Database;
  /** Points this process's reads at the opened database. */
  adopt: (db: Database) => void;
  logger: Logger;
};

/**
 * Adopts the reimported copy without restarting: the first `getStatus`
 * after the flip points this process's reads at the parallel database.
 * Runs on every `getStatus` (which every catalog read starts with) and
 * short-circuits once adopted, so the steady state costs one boolean.
 * Shared by the server, the worker and the mbslave container.
 */
export const createCutoverWatcher = (
  options: CutoverWatcherOptions,
): CutoverWatcher => {
  let adopted = false;
  return {
    adoptIfSwitched: async (): Promise<void> => {
      if (adopted) {
        return;
      }
      const switched = await options.readState();
      if (switched?.phase === 'switched' && switched.detail) {
        options.adopt(options.openDatabase(switched.detail));
        adopted = true;
        options.logger.info('Adopted the reimported copy');
      }
    },
  };
};
