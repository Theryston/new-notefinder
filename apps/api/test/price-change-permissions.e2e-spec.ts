import { billingUser } from './utils/billing-fixture.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';

describe('price change administration', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => app.close());
  beforeEach(async () => resetDatabase(app.db));
  it('rejects unauthenticated and ordinary users from retrying notices', async () => {
    await app.http.post('/v1/admin/plans/pro/price-changes/retry').expect(401);
    const user = await billingUser(app);
    await user.client
      .post('/v1/admin/plans/pro/price-changes/retry')
      .expect(403);
  });
});
