import { E2eProbeController } from './e2e-probe.controller.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';

const LIMIT = 3;

describe('Rate limiting (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({
      controllers: [E2eProbeController],
      env: { RATE_LIMIT_MAX: LIMIT },
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  // Supertest connects from loopback, a trusted proxy by default, so
  // X-Forwarded-For sets the client IP and isolates each test's bucket.
  const probe = (clientIp: string) =>
    testApp.http.get('/v1/e2e-probe').set('X-Forwarded-For', clientIp);

  it('returns the RATE_LIMITED envelope above the limit', async () => {
    for (let i = 0; i < LIMIT; i++) {
      const response = await probe('203.0.113.1').expect(200);
      expect(response.headers['x-ratelimit-remaining']).toBe(
        String(LIMIT - i - 1),
      );
    }
    const response = await probe('203.0.113.1').expect(429);
    expect(response.body).toEqual({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: expect.any(String),
    });
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('limits each client IP separately', async () => {
    for (let i = 0; i < LIMIT; i++) {
      await probe('203.0.113.2').expect(200);
    }
    await probe('203.0.113.2').expect(429);
    await probe('203.0.113.3').expect(200);
  });

  it('never limits the health check', async () => {
    for (let i = 0; i < LIMIT * 2; i++) {
      await testApp.http
        .get('/v1/health')
        .set('X-Forwarded-For', '203.0.113.4')
        .expect(200);
    }
  });
});
