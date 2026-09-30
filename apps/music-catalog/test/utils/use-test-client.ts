import { API_KEY, type TestServer } from './create-test-server.js';
import { resetDatabase } from './database.js';
import { connect, type TestClient } from './ws-client.js';

/**
 * For specs that talk to the server: before each test the database is emptied
 * and a fresh client connects (with the primary API key); after it, the
 * client hangs up. Returns a getter for the current test's client.
 */
export const useTestClient = (server: () => TestServer): (() => TestClient) => {
  let client: TestClient | undefined;

  beforeEach(async () => {
    await resetDatabase(server().db);
    client = await connect(server().url, API_KEY);
  });

  afterEach(async () => {
    await client?.close();
  });

  return () => {
    if (client === undefined) {
      throw new Error('The test client is only available inside a test');
    }
    return client;
  };
};
