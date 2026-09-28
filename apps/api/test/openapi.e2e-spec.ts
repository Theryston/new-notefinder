import { createOpenApiDocument } from '../src/setup-app.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';

describe('OpenAPI document (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  // `openapi.json` is the committed contract: CI diffs it against the base
  // branch and fails on breaking changes. After an intentional API change,
  // update it with `nub run test:e2e -- -u` and commit the result.
  it('matches the committed openapi.json', async () => {
    const document = createOpenApiDocument(testApp.app);
    await expect(`${JSON.stringify(document, null, 2)}\n`).toMatchFileSnapshot(
      '../openapi.json',
    );
  });
});
