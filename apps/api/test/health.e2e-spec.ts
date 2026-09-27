import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/setup-app.js';
import { E2eProbeController } from './e2e-probe.controller.js';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [E2eProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health returns ok', async () => {
    await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('unversioned routes do not exist', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('unknown routes return the NOT_FOUND envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/does-not-exist')
      .expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cannot GET /v1/does-not-exist',
    });
  });

  it('invalid bodies return the VALIDATION_FAILED envelope', async () => {
    const response = await request(app.getHttpServer())
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
    const response = await request(app.getHttpServer())
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
    await request(app.getHttpServer())
      .post('/v1/e2e-probe')
      .send({ limit: '5', cursor: 'abc' })
      .expect(201)
      .expect({ limit: 5, cursor: 'abc' });
  });

  it('validates and coerces query DTOs', async () => {
    await request(app.getHttpServer())
      .get('/v1/e2e-probe?limit=7')
      .expect(200)
      .expect({ limit: 7 });
    const response = await request(app.getHttpServer())
      .get('/v1/e2e-probe?limit=0')
      .expect(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { location: 'query' },
    });
  });

  it('allows CORS only for configured web origins', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/v1/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await request(app.getHttpServer())
      .get('/v1/health')
      .set('Origin', 'https://evil.example')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves the OpenAPI document generated from Zod DTOs', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
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
