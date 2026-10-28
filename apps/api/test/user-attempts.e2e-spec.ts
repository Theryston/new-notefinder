import {
  type PracticeAttemptHistoryPage,
  practiceAttemptHistoryPageSchema,
} from '@vozzify/contracts';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { practiceAttempts } from '../src/database/schema/practice-attempts.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createTrack,
  createUser,
  DEFAULT_PASSWORD,
  type Track,
  type User,
} from './utils/factories.js';

// GET /v1/users/:username/attempts is a Profile's public practice history:
// anyone may read it, newest first, one cursor page at a time. Each run
// carries the Track it was sung on, and a run flagged as bleed-suspected stays
// listed, marked as such.
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

describe('Public practice history (e2e)', () => {
  const spec = useAuthSpec();
  let owner: User;

  const anonymous = () => request(spec.testApp.app.getHttpServer());

  const history = async (
    username: string,
    query = '',
  ): Promise<PracticeAttemptHistoryPage> => {
    const response = await anonymous()
      .get(`/v1/users/${username}/attempts${query}`)
      .expect(200);
    return practiceAttemptHistoryPageSchema.parse(response.body);
  };

  const submit = async (
    track: Track,
    body: Record<string, unknown> = {},
  ): Promise<string> => {
    const response = await spec.client
      .post(`/v1/tracks/${track.id}/attempts`)
      .send({ ...run, ...body })
      .expect(201);
    return response.body.id as string;
  };

  beforeEach(async () => {
    owner = await createUser(spec.testApp.db, { username: 'grace' });
    await createCredentialAccount(spec.testApp.db, owner);
    await signIn(spec.client, {
      email: owner.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  });

  it('answers NOT_FOUND for a username no User has', async () => {
    const response = await anonymous()
      .get('/v1/users/nobody/attempts')
      .expect(404);

    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('answers an empty page for a User who never practiced', async () => {
    expect(await history('grace')).toEqual({ items: [], nextCursor: null });
  });

  it('lists the runs newest first, with the Track of each run', async () => {
    const first = await createTrack(spec.testApp.db, { title: 'First song' });
    const second = await createTrack(spec.testApp.db, { title: 'Second song' });
    const oldest = await submit(first, { accuracy: 0.5 });
    const newest = await submit(second, { accuracy: 0.9 });

    const page = await history('grace');

    expect(page.items.map((item) => item.id)).toEqual([newest, oldest]);
    expect(page.items[0]).toMatchObject({
      trackId: second.id,
      accuracy: 0.9,
      track: {
        id: second.id,
        title: 'Second song',
        coverUrl: null,
        artistCredit: [],
      },
    });
    expect(page.nextCursor).toBeNull();
  });

  it('pages through the history with the cursor, in the same order', async () => {
    const tracks = [
      await createTrack(spec.testApp.db),
      await createTrack(spec.testApp.db),
      await createTrack(spec.testApp.db),
    ];
    const ids: string[] = [];
    for (const track of tracks) {
      ids.push(await submit(track));
    }
    const newestFirst = [...ids].reverse();

    const first = await history('grace', '?limit=2');
    expect(first.items.map((item) => item.id)).toEqual(newestFirst.slice(0, 2));
    expect(first.nextCursor).toEqual(expect.any(String));

    const rest = await history('grace', `?limit=2&cursor=${first.nextCursor}`);
    expect(rest.items.map((item) => item.id)).toEqual(newestFirst.slice(2));
    expect(rest.nextCursor).toBeNull();
  });

  it('finds the same history whatever the casing of the username', async () => {
    const track = await createTrack(spec.testApp.db);
    await submit(track);

    const upper = await history('Grace');

    expect(upper).toEqual(await history('grace'));
    expect(upper.items).toHaveLength(1);
  });

  it('keeps bleed-suspected runs in the history, flagged', async () => {
    const track = await createTrack(spec.testApp.db);
    const id = await submit(track, { bleedSuspected: true });

    const page = await history('grace');

    expect(page.items).toEqual([
      expect.objectContaining({ id, bleedSuspected: true }),
    ]);
  });

  it('lists only the runs of the User named in the path', async () => {
    const track = await createTrack(spec.testApp.db);
    await submit(track);
    await createUser(spec.testApp.db, { username: 'ada' });

    expect(await history('ada')).toEqual({ items: [], nextCursor: null });
  });

  it('pages runs saved in the same millisecond without skipping or repeating any', async () => {
    // The column keeps microseconds, so these three runs share the millisecond
    // 10:00:00.000 and differ only in their microseconds. The page size of 2
    // puts the boundary inside that group.
    const track = await createTrack(spec.testApp.db);
    const savedAt = [
      '2026-10-16 10:00:00.000100+00',
      '2026-10-16 10:00:00.000200+00',
      '2026-10-16 10:00:00.000300+00',
    ];
    for (const [index, instant] of savedAt.entries()) {
      await spec.testApp.db.insert(practiceAttempts).values({
        id: `run-${index}`,
        userId: owner.id,
        trackId: track.id,
        difficulty: 'NORMAL',
        octaveMode: 'ANY',
        transposeSemitones: 0,
        speed: 1,
        accuracy: 0.8,
        coverage: 0.95,
        startedAt: new Date('2026-10-16T10:00:00.000Z'),
        endedAt: new Date('2026-10-16T10:04:00.000Z'),
        createdAt: sql`${instant}::timestamptz`,
        updatedAt: sql`${instant}::timestamptz`,
      });
    }

    // Same millisecond, so the ID decides: run-2, run-1, then run-0 on the next page.
    const first = await history('grace', '?limit=2');
    const rest = await history('grace', `?limit=2&cursor=${first.nextCursor}`);

    expect(first.items.map((item) => item.id)).toEqual(['run-2', 'run-1']);
    expect(rest.items.map((item) => item.id)).toEqual(['run-0']);
    expect(rest.nextCursor).toBeNull();
  });

  it('answers 400 for a cursor this API did not issue', async () => {
    const response = await anonymous()
      .get('/v1/users/grace/attempts?cursor=not-a-cursor')
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
