import { REDIS_CLIENT } from '../src/redis/redis.constants.js';
import { E2eProbeController } from './e2e-probe.controller.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';

describe('Health (e2e)', () => {
  let testApp: TestApp;
  let http: TestApp['http'];

  beforeAll(async () => {
    testApp = await createTestApp({ controllers: [E2eProbeController] });
    http = testApp.http;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('GET /v1/health returns ok', async () => {
    await http.get('/v1/health').expect(200).expect({ status: 'ok' });
  });

  it('GET /v1/health/ready checks the real database', async () => {
    await http
      .get('/v1/health/ready')
      .expect(200)
      .expect({ status: 'ok', checks: { database: 'ok', redis: 'ok' } });
  });

  it('unversioned routes do not exist', async () => {
    await http.get('/health').expect(404);
  });

  it('unknown routes return the NOT_FOUND envelope', async () => {
    const response = await http.get('/v1/does-not-exist').expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cannot GET /v1/does-not-exist',
    });
  });

  it('invalid bodies return the VALIDATION_FAILED envelope', async () => {
    const response = await http
      .post('/v1/e2e-probe')
      .send({ limit: 1000 })
      .expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      details: {
        location: 'body',
        issues: [expect.objectContaining({ path: ['limit'] })],
      },
    });
  });

  it('malformed JSON returns the BAD_REQUEST envelope', async () => {
    const response = await http
      .post('/v1/e2e-probe')
      .set('Content-Type', 'application/json')
      .send('{"limit":')
      .expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
    });
  });

  it('parses valid bodies and serializes responses through the schema', async () => {
    await http
      .post('/v1/e2e-probe')
      .send({ limit: '5', cursor: 'abc' })
      .expect(201)
      .expect({ limit: 5, cursor: 'abc' });
  });

  it('validates and coerces query DTOs', async () => {
    await http.get('/v1/e2e-probe?limit=7').expect(200).expect({ limit: 7 });
    const response = await http.get('/v1/e2e-probe?limit=0').expect(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { location: 'query' },
    });
  });

  it('allows CORS only for configured web origins', async () => {
    const allowed = await http
      .get('/v1/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await http
      .get('/v1/health')
      .set('Origin', 'https://evil.example')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves the OpenAPI document generated from Zod DTOs', async () => {
    const response = await http.get('/docs-json').expect(200);
    expect(response.body.paths).toHaveProperty(['/v1/health']);
    expect(response.body.paths['/v1/e2e-probe'].get.parameters).toEqual([
      expect.objectContaining({
        name: 'cursor',
        in: 'query',
        required: false,
        schema: expect.objectContaining({ type: 'string', minLength: 1 }),
      }),
      expect.objectContaining({
        name: 'limit',
        in: 'query',
        required: false,
        schema: expect.objectContaining({ type: 'integer', maximum: 100 }),
      }),
    ]);
    expect(response.body.components.schemas.ProbeDto).toMatchObject({
      type: 'object',
      properties: {
        cursor: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
    });
  });
});

describe('Health readiness with failing dependencies (e2e)', () => {
  let testApp: TestApp | undefined;

  afterEach(async () => {
    await testApp?.close();
    testApp = undefined;
  });

  it('returns 503 when the database is unreachable', async () => {
    testApp = await createTestApp({
      // Nothing listens on port 1, so the connection is refused at once.
      env: { DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:1/none' },
    });
    await testApp.http
      .get('/v1/health/ready')
      .expect(503)
      .expect({ status: 'error', checks: { database: 'error', redis: 'ok' } });
    // Liveness stays up: restarting the instance wouldn't fix the database.
    await testApp.http.get('/v1/health').expect(200);
  });

  it('returns 503 when Redis does not answer', async () => {
    testApp = await createTestApp({
      override: (builder) =>
        builder.overrideProvider(REDIS_CLIENT).useValue({
          status: 'end',
          disconnect: () => undefined,
          ping: () => Promise.reject(new Error('Connection is closed')),
        }),
    });
    await testApp.http
      .get('/v1/health/ready')
      .expect(503)
      .expect({ status: 'error', checks: { database: 'ok', redis: 'error' } });
  });
});
