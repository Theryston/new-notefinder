import {
  type PracticeAttempt,
  type PracticeAttemptPage,
  practiceAttemptPageSchema,
  practiceAttemptSchema,
  type TrackPracticeState,
  trackPracticeStateSchema,
} from '@vozzify/contracts';
import request from 'supertest';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createTrack,
  createUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';
import { createLegacyTrackId } from './utils/track-processing-factories.js';

// POST /v1/tracks/:trackId/attempts saves a signed-in User's valid run, and
// GET /v1/me/tracks/:trackId carries the best saved score per difficulty.
// Only valid runs are saved: under 90% coverage or a forward skip is refused
// with ATTEMPT_REJECTED, so no client can write a run the page never submits.
const run = {
  difficulty: 'NORMAL',
  octaveMode: 'ANY',
  transposeSemitones: 0,
  speed: 1,
  accuracy: 0.8,
  coverage: 0.95,
  forwardSkip: false,
  bleedSuspected: false,
  startedAt: '2026-10-16T10:00:00.000Z',
  endedAt: '2026-10-16T10:04:00.000Z',
} as const;

describe('Practice attempts (e2e)', () => {
  const spec = useAuthSpec();
  let user: User;

  const submit = async (
    trackId: string,
    body: Record<string, unknown> = {},
  ): Promise<PracticeAttempt> => {
    const response = await spec.client
      .post(`/v1/tracks/${trackId}/attempts`)
      .send({ ...run, ...body })
      .expect(201);
    return practiceAttemptSchema.parse(response.body);
  };

  const stateOf = async (trackId: string): Promise<TrackPracticeState> => {
    const response = await spec.client
      .get(`/v1/me/tracks/${trackId}`)
      .expect(200);
    return trackPracticeStateSchema.parse(response.body);
  };

  beforeEach(async () => {
    user = await createUser(spec.testApp.db, { username: 'grace' });
    await createCredentialAccount(spec.testApp.db, user);
    await signIn(spec.client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  });

  it('answers 401 without a session', async () => {
    const track = await createTrack(spec.testApp.db);

    const response = await request(spec.testApp.app.getHttpServer())
      .post(`/v1/tracks/${track.id}/attempts`)
      .send(run)
      .expect(401);

    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('saves a valid run with its bleed flag', async () => {
    const track = await createTrack(spec.testApp.db);

    const attempt = await submit(track.id, {
      bleedSuspected: true,
      accuracy: 0.75,
    });

    expect(attempt).toMatchObject({
      trackId: track.id,
      difficulty: 'NORMAL',
      octaveMode: 'ANY',
      transposeSemitones: 0,
      speed: 1,
      accuracy: 0.75,
      coverage: 0.95,
      forwardSkip: false,
      bleedSuspected: true,
    });
  });

  it('rejects a run under 90% coverage with ATTEMPT_REJECTED', async () => {
    const track = await createTrack(spec.testApp.db);

    const response = await spec.client
      .post(`/v1/tracks/${track.id}/attempts`)
      .send({ ...run, coverage: 0.89 })
      .expect(422);

    expect(response.body).toMatchObject({
      code: 'ATTEMPT_REJECTED',
      details: { reason: 'COVERAGE' },
    });
    expect(await stateOf(track.id)).toMatchObject({
      bestScores: { EASY: null, NORMAL: null, HARD: null },
    });
  });

  it('rejects a run that skipped forward with ATTEMPT_REJECTED', async () => {
    const track = await createTrack(spec.testApp.db);

    const response = await spec.client
      .post(`/v1/tracks/${track.id}/attempts`)
      .send({ ...run, coverage: 1, forwardSkip: true })
      .expect(422);

    expect(response.body).toMatchObject({
      code: 'ATTEMPT_REJECTED',
      details: { reason: 'FORWARD_SKIP' },
    });
  });

  it('reads the best saved score per difficulty', async () => {
    const track = await createTrack(spec.testApp.db);
    await submit(track.id, { difficulty: 'NORMAL', accuracy: 0.8 });
    await submit(track.id, { difficulty: 'NORMAL', accuracy: 0.6 });
    await submit(track.id, {
      difficulty: 'HARD',
      octaveMode: 'EXACT',
      accuracy: 0.5,
    });

    expect(await stateOf(track.id)).toEqual({
      isFavorite: false,
      bestScores: { EASY: null, NORMAL: 0.8, HARD: 0.5 },
    });
  });

  it('keeps each User best scores apart', async () => {
    const track = await createTrack(spec.testApp.db);
    await submit(track.id, { accuracy: 0.8 });
    const other = await createUser(spec.testApp.db, { username: 'ada' });
    await createCredentialAccount(spec.testApp.db, other);
    await signIn(spec.client, {
      email: other.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);

    expect(await stateOf(track.id)).toMatchObject({
      bestScores: { EASY: null, NORMAL: null, HARD: null },
    });
  });

  it('answers 404 NOT_FOUND for an unknown Track', async () => {
    const response = await spec.client
      .post('/v1/tracks/nope/attempts')
      .send(run)
      .expect(404);

    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('answers a legacy Track ID with 404 RESOURCE_MOVED and the new ID', async () => {
    const track = await createTrack(spec.testApp.db);
    await createLegacyTrackId(spec.testApp.db, track.id, 'clx123abc');

    const response = await spec.client
      .post('/v1/tracks/clx123abc/attempts')
      .send(run)
      .expect(404);

    expect(response.body).toMatchObject({
      code: 'RESOURCE_MOVED',
      details: { id: track.id },
    });
  });

  describe('GET /v1/me/attempts', () => {
    const list = async (query = ''): Promise<PracticeAttemptPage> => {
      const response = await spec.client
        .get(`/v1/me/attempts${query}`)
        .expect(200);
      return practiceAttemptPageSchema.parse(response.body);
    };

    it('answers 401 without a session', async () => {
      const response = await request(spec.testApp.app.getHttpServer())
        .get('/v1/me/attempts')
        .expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('lists the own attempts newest first, across pages', async () => {
      const first = await createTrack(spec.testApp.db);
      const second = await createTrack(spec.testApp.db);
      const oldest = await submit(first.id, { accuracy: 0.5 });
      const newest = await submit(second.id, { accuracy: 0.9 });

      const page = await list('?limit=1');

      expect(page.items.map((item) => item.id)).toEqual([newest.id]);
      expect(page.nextCursor).toEqual(expect.any(String));

      const rest = await list(`?limit=1&cursor=${page.nextCursor}`);
      expect(rest.items.map((item) => item.id)).toEqual([oldest.id]);
      expect(rest.nextCursor).toBeNull();
    });

    it('lists only the signed-in User attempts', async () => {
      const track = await createTrack(spec.testApp.db);
      await submit(track.id);
      const other = await createUser(spec.testApp.db, { username: 'ada' });
      await createCredentialAccount(spec.testApp.db, other);
      await signIn(spec.client, {
        email: other.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);

      expect(await list()).toMatchObject({ items: [], nextCursor: null });
    });
  });
});
