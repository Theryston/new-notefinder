import { trackAudioSchema } from '@vozzify/contracts';
import request from 'supertest';
import { createAuthClient, signIn } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createPasswordUser,
  createTrack,
  DEFAULT_PASSWORD,
} from './utils/factories.js';
import { createTrackProcessing } from './utils/track-processing-factories.js';

const audio = {
  musicMp3Url: 'https://audio.example/music.mp3',
  vocalsMp3Url: 'https://audio.example/vocals.mp3',
};

describe('admin direct audio (e2e)', () => {
  let testApp: TestApp;
  beforeAll(async () => {
    testApp = await createTestApp();
  });
  afterAll(async () => {
    await testApp.close();
  });
  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  it('returns 403 for visitors and Users without disclosing whether the Track exists', async () => {
    const path = '/v1/tracks/unknown-track/audio';
    const visitor = await request(testApp.app.getHttpServer())
      .get(path)
      .expect(403);
    expect(visitor.body.code).toBe('FORBIDDEN');
    const user = await createPasswordUser(testApp.db);
    const client = createAuthClient(testApp);
    await signIn(client, { email: user.email, password: DEFAULT_PASSWORD });
    const response = await client.get(path).expect(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(JSON.stringify(response.body)).not.toContain('.mp3');
  });

  it('returns the newest completed Processing, ignoring a later failed run', async () => {
    const admin = await createPasswordUser(testApp.db, { role: 'ADMIN' });
    const client = createAuthClient(testApp);
    await signIn(client, { email: admin.email, password: DEFAULT_PASSWORD });
    const track = await createTrack(testApp.db);
    await createTrackProcessing(testApp.db, track.id, {
      status: 'COMPLETED',
      createdAt: new Date('2026-01-01'),
      musicMp3Url: 'https://audio.example/old.mp3',
      vocalsMp3Url: 'https://audio.example/old-vocals.mp3',
    });
    await createTrackProcessing(testApp.db, track.id, {
      status: 'COMPLETED',
      createdAt: new Date('2026-01-02'),
      ...audio,
    });
    await createTrackProcessing(testApp.db, track.id, {
      status: 'FAILED',
      createdAt: new Date('2026-01-03'),
      musicMp3Url: 'https://audio.example/failed.mp3',
    });
    const response = await client
      .get(`/v1/tracks/${track.id}/audio`)
      .expect(200);
    expect(trackAudioSchema.parse(response.body)).toEqual(audio);
    expect(response.headers['cache-control']).toBe('private, no-store');
    await client.get('/v1/tracks/missing/audio').expect(404);
  });
});
