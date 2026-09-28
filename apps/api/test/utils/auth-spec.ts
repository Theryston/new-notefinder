import { AuthProbeController } from '../auth-probe.controller.js';
import { type AuthClient, clearEmails, createAuthClient } from './auth.js';
import { createTestApp, type TestApp } from './create-test-app.js';
import { resetDatabase } from './database.js';

export type AuthSpec = {
  /** The app, with the auth probe routes mounted. */
  readonly testApp: TestApp;
  /** A signed-out client, fresh for each test. */
  readonly client: AuthClient;
};

const ready = <T>(value: T | undefined, name: string): T => {
  if (value === undefined) {
    throw new Error(`${name} is only available inside tests`);
  }
  return value;
};

/**
 * Registers the hooks shared by the auth specs: one app per file, and a
 * clean database, email queue and client before each test. Call it at the
 * top of a `describe` and read `testApp`/`client` inside tests.
 */
export const useAuthSpec = (): AuthSpec => {
  let testApp: TestApp | undefined;
  let client: AuthClient | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ controllers: [AuthProbeController] });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  beforeEach(async () => {
    const app = ready(testApp, 'testApp');
    await resetDatabase(app.db);
    clearEmails(app);
    client = createAuthClient(app);
  });

  return {
    get testApp() {
      return ready(testApp, 'testApp');
    },
    get client() {
      return ready(client, 'client');
    },
  };
};
