import {
  type StreakHeartbeatResult,
  type StreakStatus,
  streakHeartbeatResultSchema,
  streakStatusSchema,
} from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { dailyPracticeStreaks } from '../src/database/schema/daily-practice-streaks.js';
import { users } from '../src/database/schema/users.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';

// GET /v1/me/streak and POST /v1/me/streak/heartbeat are the signed-in User's
// own practice. The API's clock decides what a heartbeat may credit, so the
// tests move it with fake dates (only `Date`: the database and HTTP keep
// real timers).
const SAO_PAULO = 'America/Sao_Paulo';
const TOKYO = 'Asia/Tokyo';
// 23:30 on 9 March in Sao Paulo, 08:30 on the 10th in Tokyo.
const NIGHT = '2026-03-10T02:30:00Z';

const at = (iso: string) => vi.setSystemTime(new Date(iso));
const later = (iso: string, seconds: number) =>
  new Date(new Date(iso).getTime() + seconds * 1000);

describe('Streaks (e2e)', () => {
  const spec = useAuthSpec();
  let user: User;

  const signInAs = async (signedUp: User) => {
    await createCredentialAccount(spec.testApp.db, signedUp);
    await signIn(spec.client, {
      email: signedUp.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  };

  const heartbeat = async (
    elapsedSeconds: number,
    timeZone = 'UTC',
  ): Promise<StreakHeartbeatResult> => {
    const response = await spec.client
      .post('/v1/me/streak/heartbeat')
      .send({ elapsedSeconds, timeZone })
      .expect(200);
    return streakHeartbeatResultSchema.parse(response.body);
  };

  const status = async (query = ''): Promise<StreakStatus> => {
    const response = await spec.client.get(`/v1/me/streak${query}`).expect(200);
    return streakStatusSchema.parse(response.body);
  };

  const seedDays = async (days: string[], completed = true) => {
    await spec.testApp.db
      .insert(dailyPracticeStreaks)
      .values(days.map((day) => ({ userId: user.id, day, completed })));
  };

  beforeEach(async () => {
    // Sign in on the real clock: the session must exist before time moves.
    user = await createUser(spec.testApp.db, {
      username: 'grace',
      // The smallest preset, so a test completes the day in as few
      // heartbeats as a preset allows.
      dailyPracticeTargetSeconds: 300,
    });
    await signInAs(user);
    vi.useFakeTimers({ toFake: ['Date'] });
    at(NIGHT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe.each([
    { method: 'get', path: '/v1/me/streak' },
    { method: 'post', path: '/v1/me/streak/heartbeat' },
  ] as const)('$method $path', ({ method, path }) => {
    it('answers 401 without a session', async () => {
      const response = await request(spec.testApp.app.getHttpServer())
        [method](path)
        .expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  describe('GET /v1/me/streak', () => {
    describe('changing the Daily target mid-day', () => {
      const saveTarget = (value: string) =>
        spec.client
          .patch('/v1/me')
          .field('name', user.name)
          .field('dailyPracticeTargetSeconds', value);

      const seedDay = (
        day: string,
        listenedSeconds: number,
        completed: boolean,
      ) =>
        spec.testApp.db
          .insert(dailyPracticeStreaks)
          .values({ userId: user.id, day, listenedSeconds, completed });

      it('reports the new target at once, then completes today on the next heartbeat', async () => {
        // 400 s would already complete the 5-minute default, so start at 900.
        await saveTarget('900').expect(200);
        await seedDay('2026-03-10', 400, false);
        expect(await status()).toMatchObject({
          targetSeconds: 900,
          listenedSeconds: 400,
          completedToday: false,
        });

        await saveTarget('300').expect(200);

        // The ring recalculates immediately: the full 300 s count.
        expect(await status()).toMatchObject({
          targetSeconds: 300,
          listenedSeconds: 300,
        });
        // The next heartbeat reaches the lowered target and celebrates once.
        const reached = await heartbeat(1);
        expect(reached.justCompleted).toBe(true);
        expect(reached.status).toMatchObject({
          targetSeconds: 300,
          listenedSeconds: 300,
          completedToday: true,
          currentStreakDays: 1,
        });
      });

      it('keeps today completed after the target is raised', async () => {
        await seedDay('2026-03-10', 300, true);

        await saveTarget('1800').expect(200);

        expect(await status()).toMatchObject({
          targetSeconds: 1800,
          listenedSeconds: 1800,
          completedToday: true,
          currentStreakDays: 1,
        });
        expect((await heartbeat(5)).justCompleted).toBe(false);
      });

      it('leaves past completed days alone when the target changes', async () => {
        await seedDay('2026-03-09', 300, true);
        await seedDay('2026-03-08', 300, true);

        await saveTarget('1800').expect(200);

        const rows = await spec.testApp.db
          .select({
            day: dailyPracticeStreaks.day,
            listenedSeconds: dailyPracticeStreaks.listenedSeconds,
            completed: dailyPracticeStreaks.completed,
          })
          .from(dailyPracticeStreaks)
          .where(eq(dailyPracticeStreaks.userId, user.id));
        expect(rows).toHaveLength(2);
        expect(rows).toEqual(
          expect.arrayContaining([
            { day: '2026-03-09', listenedSeconds: 300, completed: true },
            { day: '2026-03-08', listenedSeconds: 300, completed: true },
          ]),
        );
        expect(await status()).toMatchObject({
          completedToday: false,
          currentStreakDays: 2,
        });
      });
    });

    it('starts empty, at the default target when the User never picked one', async () => {
      const other = await createUser(spec.testApp.db, { username: 'ada' });
      await spec.client.post('/v1/auth/sign-out').send({});
      await signInAs(other);

      expect(await status()).toEqual({
        day: '2026-03-10',
        listenedSeconds: 0,
        targetSeconds: 300,
        completedToday: false,
        currentStreakDays: 0,
      });
    });

    it('answers 400 VALIDATION_FAILED for an unknown time zone', async () => {
      const response = await spec.client
        .get('/v1/me/streak?timeZone=Mars/Olympus')
        .expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { location: 'query' },
      });
    });

    it('reads today in the time zone asked for, without storing it', async () => {
      expect((await status(`?timeZone=${SAO_PAULO}`)).day).toBe('2026-03-09');
      expect((await status(`?timeZone=${TOKYO}`)).day).toBe('2026-03-10');

      const [row] = await spec.testApp.db
        .select({ timeZone: users.timeZone })
        .from(users)
        .where(eq(users.id, user.id));
      expect(row?.timeZone).toBeNull();
    });

    it('counts the run of completed days ending today', async () => {
      await seedDays(['2026-03-10', '2026-03-09', '2026-03-08', '2026-03-05']);

      expect(await status()).toMatchObject({
        completedToday: true,
        currentStreakDays: 3,
        listenedSeconds: 300,
      });
    });

    it('keeps the run ending yesterday while today is still open', async () => {
      await seedDays(['2026-03-09', '2026-03-08']);

      expect(await status()).toMatchObject({
        completedToday: false,
        currentStreakDays: 2,
      });
    });

    it('drops the streak once a whole day was missed', async () => {
      await seedDays(['2026-03-08', '2026-03-07']);

      expect((await status()).currentStreakDays).toBe(0);
    });

    it('does not count days that were practiced but not completed', async () => {
      await seedDays(['2026-03-09'], false);

      expect((await status()).currentStreakDays).toBe(0);
    });
  });

  describe('POST /v1/me/streak/heartbeat', () => {
    it.each([
      {
        name: 'negative seconds',
        body: { elapsedSeconds: -1, timeZone: 'UTC' },
      },
      { name: 'a missing zone', body: { elapsedSeconds: 5 } },
      {
        name: 'an unknown zone',
        body: { elapsedSeconds: 5, timeZone: 'Nope' },
      },
      { name: 'text seconds', body: { elapsedSeconds: 'x', timeZone: 'UTC' } },
    ])('answers 400 VALIDATION_FAILED for $name', async ({ body }) => {
      const response = await spec.client
        .post('/v1/me/streak/heartbeat')
        .send(body)
        .expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { location: 'body' },
      });
    });

    it('credits the seconds and answers the status', async () => {
      const result = await heartbeat(5);

      expect(result).toEqual({
        status: {
          day: '2026-03-10',
          listenedSeconds: 5,
          targetSeconds: 300,
          completedToday: false,
          currentStreakDays: 0,
        },
        justCompleted: false,
        creditedSeconds: 5,
      });
      expect((await status()).listenedSeconds).toBe(5);
    });

    it('credits at most 20 seconds per call', async () => {
      const result = await heartbeat(600);

      expect(result.creditedSeconds).toBe(20);
      expect(result.status.listenedSeconds).toBe(20);
    });

    it('credits nothing for zero seconds and does not start the clock', async () => {
      expect((await heartbeat(0)).creditedSeconds).toBe(0);

      expect((await heartbeat(1)).creditedSeconds).toBe(1);
    });

    it('credits no more than the server clock saw pass since the last heartbeat', async () => {
      await heartbeat(20);

      at(later(NIGHT, 3).toISOString());
      const early = await heartbeat(20);

      expect(early.creditedSeconds).toBe(3);
      expect(early.status.listenedSeconds).toBe(23);

      at(later(NIGHT, 60).toISOString());
      expect((await heartbeat(20)).creditedSeconds).toBe(20);
    });

    it('stops a flood of heartbeats from crediting more than real time', async () => {
      await heartbeat(20);
      const results = await Promise.all([heartbeat(20), heartbeat(20)]);

      const credited = results.reduce(
        (sum, result) => sum + result.creditedSeconds,
        0,
      );
      expect(credited).toBe(0);
    });

    it('completes the day once the target is reached, and says so once', async () => {
      // Fifteen 20 s heartbeats reach the 300 s target; each needs the
      // server clock moved past the previous one to credit in full.
      await heartbeat(20);
      for (let step = 1; step <= 13; step++) {
        at(later(NIGHT, step * 20).toISOString());
        await heartbeat(20);
      }
      at(later(NIGHT, 280).toISOString());
      const reached = await heartbeat(20);

      expect(reached.justCompleted).toBe(true);
      expect(reached.status).toMatchObject({
        completedToday: true,
        listenedSeconds: 300,
        currentStreakDays: 1,
      });

      at(later(NIGHT, 300).toISOString());
      const after = await heartbeat(20);
      expect(after.justCompleted).toBe(false);
      expect(after.status).toMatchObject({
        completedToday: true,
        listenedSeconds: 300,
        currentStreakDays: 1,
      });
    });

    it('keeps the completion time of the heartbeat that reached the target', async () => {
      await heartbeat(20);
      for (let step = 1; step <= 13; step++) {
        at(later(NIGHT, step * 20).toISOString());
        await heartbeat(20);
      }
      at(later(NIGHT, 280).toISOString());
      await heartbeat(20);
      at(later(NIGHT, 300).toISOString());
      await heartbeat(20);

      const [row] = await spec.testApp.db
        .select()
        .from(dailyPracticeStreaks)
        .where(eq(dailyPracticeStreaks.userId, user.id));
      expect(row?.completedAt).toEqual(later(NIGHT, 280));
      expect(row?.listenedSeconds).toBe(320);
    });

    it('extends the streak across days', async () => {
      await seedDays(['2026-03-09', '2026-03-08']);
      await heartbeat(20);
      for (let step = 1; step <= 13; step++) {
        at(later(NIGHT, step * 20).toISOString());
        await heartbeat(20);
      }
      at(later(NIGHT, 280).toISOString());

      const result = await heartbeat(20);

      expect(result.justCompleted).toBe(true);
      expect(result.status.currentStreakDays).toBe(3);
    });

    it('stores the time zone of the heartbeat and updates it on the next', async () => {
      const zoneOf = async () => {
        const [row] = await spec.testApp.db
          .select({ timeZone: users.timeZone })
          .from(users)
          .where(eq(users.id, user.id));
        return row?.timeZone;
      };

      await heartbeat(5, SAO_PAULO);
      expect(await zoneOf()).toBe(SAO_PAULO);

      await heartbeat(5, TOKYO);
      expect(await zoneOf()).toBe(TOKYO);
    });

    it('uses the stored time zone to read the status afterwards', async () => {
      await heartbeat(5, SAO_PAULO);

      expect((await status()).day).toBe('2026-03-09');
    });

    it('rolls the day over at midnight in the time zone, not in UTC', async () => {
      const saoPaulo = await heartbeat(5, SAO_PAULO);
      expect(saoPaulo.status.day).toBe('2026-03-09');

      // 00:30 on the 10th in Sao Paulo, still the 10th in UTC.
      at('2026-03-10T03:30:00Z');
      const nextDay = await heartbeat(5, SAO_PAULO);

      expect(nextDay.status).toMatchObject({
        day: '2026-03-10',
        listenedSeconds: 5,
      });
      const days = await spec.testApp.db
        .select({ day: dailyPracticeStreaks.day })
        .from(dailyPracticeStreaks)
        .where(eq(dailyPracticeStreaks.userId, user.id));
      expect(days.map((row) => row.day).sort()).toEqual([
        '2026-03-09',
        '2026-03-10',
      ]);
    });

    it('puts the same instant on different days in two time zones', async () => {
      const saoPauloUser = await createUser(spec.testApp.db, {
        username: 'ada',
      });
      const tokyo = await spec.client
        .post('/v1/me/streak/heartbeat')
        .send({ elapsedSeconds: 5, timeZone: TOKYO })
        .expect(200);
      const tokyoDay = streakHeartbeatResultSchema.parse(tokyo.body).status.day;
      await spec.client.post('/v1/auth/sign-out').send({});
      await signInAs(saoPauloUser);
      const saoPaulo = await heartbeat(5, SAO_PAULO);

      expect(tokyoDay).toBe('2026-03-10');
      expect(saoPaulo.status.day).toBe('2026-03-09');
    });

    it('checks the clock across days: a heartbeat right after midnight is bounded by the previous day', async () => {
      at('2026-03-10T02:59:50Z');
      await heartbeat(20, SAO_PAULO);
      at('2026-03-10T03:00:00Z');

      const result = await heartbeat(20, SAO_PAULO);

      expect(result.status.day).toBe('2026-03-10');
      expect(result.creditedSeconds).toBe(10);
    });

    it('keeps one clock per User, however the time zone is switched', async () => {
      const first = await heartbeat(20, 'Pacific/Kiritimati');
      const second = await heartbeat(20, 'Etc/GMT+12');
      const third = await heartbeat(20, 'Pacific/Kiritimati');

      expect(first.creditedSeconds).toBe(20);
      expect(second.status.day).not.toBe(first.status.day);
      expect(second.creditedSeconds).toBe(0);
      expect(third.creditedSeconds).toBe(0);
      const rows = await spec.testApp.db
        .select({ listened: dailyPracticeStreaks.listenedSeconds })
        .from(dailyPracticeStreaks)
        .where(eq(dailyPracticeStreaks.userId, user.id));
      expect(rows.reduce((sum, row) => sum + row.listened, 0)).toBe(20);
    });

    it('credits a 5 s heartbeat that arrives a few milliseconds early in full', async () => {
      await heartbeat(20);
      at(new Date(new Date(NIGHT).getTime() + 4_990).toISOString());

      expect((await heartbeat(5)).creditedSeconds).toBe(5);
    });

    it('writes nothing for a heartbeat with no seconds to credit', async () => {
      await heartbeat(0, TOKYO);

      const [row] = await spec.testApp.db
        .select({ timeZone: users.timeZone })
        .from(users)
        .where(eq(users.id, user.id));
      expect(row?.timeZone).toBeNull();
      expect(
        await spec.testApp.db
          .select()
          .from(dailyPracticeStreaks)
          .where(eq(dailyPracticeStreaks.userId, user.id)),
      ).toEqual([]);
    });

    it('credits the heartbeat after local midnight to the new day', async () => {
      // 23:59:50 in Sao Paulo, then 00:00:10 the next day.
      at('2026-03-10T02:59:50Z');
      await heartbeat(20, SAO_PAULO);
      at('2026-03-10T03:00:10Z');
      const result = await heartbeat(20, SAO_PAULO);

      // The 20 s since the last heartbeat all fall in the new day.
      expect(result.status).toMatchObject({
        day: '2026-03-10',
        listenedSeconds: 20,
      });
      expect((await status(`?timeZone=${SAO_PAULO}`)).day).toBe('2026-03-10');
    });
  });
});
