import { createDatabase, createPool } from '../../database/database.js';
import { ReimportStateRepository } from './reimport-state.repository.js';
import type { ReimportPointer } from './resolve-serving-url.js';

/**
 * Reads one database's reimport pointer with a throwaway pool: what the
 * entrypoints resolve the serving database with at boot, before opening
 * the pool they keep. The pool is always closed, so a flipped copy never
 * leaks a connection per start.
 */
export const readReimportStateOf = async (
  url: string,
  onError: (error: Error) => void,
): Promise<ReimportPointer> => {
  const pool = createPool(url, onError);
  try {
    return await new ReimportStateRepository(createDatabase(pool)).get();
  } finally {
    await pool.end();
  }
};
