import type { TestServer } from './create-test-server.js';
import { setBootstrapState } from './database.js';

/**
 * Marks the first import as finished before each test, which is what every
 * operation that reads the catalog needs to answer. Call it after
 * `useTestClient`, whose `beforeEach` empties the database first.
 */
export const useReadyCatalog = (server: () => TestServer): void => {
  beforeEach(async () => {
    await setBootstrapState(server().db, { phase: 'ready', dataset: 'tiny' });
  });
};
