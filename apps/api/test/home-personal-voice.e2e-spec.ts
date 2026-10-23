import type { TestingModuleBuilder } from '@nestjs/testing';
import type { HomeRow } from '@notefinder/contracts';
import type { z } from 'zod';
import { REFRESH_PERSONAL_HOME_FEED_JOB } from '../src/modules/home/home-personal.job.js';
import { PersonalHomeProcessor } from '../src/modules/home/home-personal.processor.js';
import { PersonalHomeRepository } from '../src/modules/home/home-personal.repository.js';
import { PersonalHomeStore } from '../src/modules/home/home-personal.store.js';
import { PersonalHomeBuilder } from '../src/modules/home/home-personal-builder.service.js';
import { PersonalHomeQueueService } from '../src/modules/home/home-personal-queue.service.js';
import { CacheService } from '../src/redis/cache.service.js';
import { createAuthClient, signIn } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

class MemoryCache {
  private readonly values = new Map<string, unknown>();

  async get<T>(key: string, schema: z.ZodType<T>): Promise<T | undefined> {
    const parsed = schema.safeParse(this.values.get(key));
    return parsed.success ? parsed.data : undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  async acquire(): Promise<boolean> {
    return true;
  }

  async del(key: string): Promise<void> {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const cache = new MemoryCache();
const overrideCache = (builder: TestingModuleBuilder) =>
  builder.overrideProvider(CacheService).useValue(cache);

const accurateRun = {
  difficulty: 'NORMAL',
  octaveMode: 'ANY',
  transposeSemitones: 0,
  speed: 1,
  accuracy: 0.95,
  coverage: 0.95,
  forwardSkip: false,
  bleedSuspected: false,
  startedAt: '2026-10-20T10:00:00.000Z',
  endedAt: '2026-10-20T10:04:00.000Z',
} as const;

const ordinaryRun = { ...accurateRun, accuracy: 0.5 };

const idsIn = (rows: HomeRow[], rowId: string): string[] => {
  const row = rows.find((item) => item.id === rowId);
  return row?.layout === 'vocal-range' ? row.items.map((item) => item.id) : [];
};

const allTrackIds = (rows: HomeRow[]): string[] =>
  rows.flatMap((row) => {
    if (row.layout === 'hero') return [row.track.id];
    if (
      row.layout === 'standard' ||
      row.layout === 'vocal-range' ||
      row.layout === 'ranked'
    ) {
      return row.items.map((item) => item.id);
    }
    return [];
  });

describe('Personal home voice rows (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ override: overrideCache });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    cache.clear();
    await resetDatabase(testApp.db);
  });

  const signInUser = async (suffix: string) => {
    const user = await createUser(testApp.db, {
      username: `voice_${suffix}`,
      email: `voice-${suffix}@example.com`,
    });
    await createCredentialAccount(testApp.db, user);
    const client = createAuthClient(testApp);
    await signIn(client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    return { user, client };
  };

  const refreshPersonalFeed = async (userId: string) => {
    const processor = new PersonalHomeProcessor(
      testApp.app.get(PersonalHomeBuilder),
      testApp.app.get(PersonalHomeStore),
      testApp.app.get(PersonalHomeRepository),
      testApp.app.get(PersonalHomeQueueService),
    );
    await processor.process({
      name: REFRESH_PERSONAL_HOME_FEED_JOB,
      data: { userId, locale: 'en' },
    } as Parameters<PersonalHomeProcessor['process']>[0]);
  };

  const seedVoiceTracks = async () => {
    const reference = await createCompletedTrack(testApp.db, {
      title: 'Voice reference',
      vocalRangeLowest: 60,
      vocalRangeHighest: 68,
    });
    const exact = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        createCompletedTrack(testApp.db, {
          title: `Within voice ${index}`,
          vocalRangeLowest: 60,
          vocalRangeHighest: 68,
          trendingScore: 100 - index,
        }),
      ),
    );
    const challenges = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        createCompletedTrack(testApp.db, {
          title: `Challenge voice ${index}`,
          vocalRangeLowest: 59,
          vocalRangeHighest: 69,
          trendingScore: 50 - index,
        }),
      ),
    );
    return { reference, exact, challenges };
  };

  it('serves deduped within-voice and challenge rows from the derived range', async () => {
    const { reference, exact, challenges } = await seedVoiceTracks();
    const { user, client } = await signInUser('range');
    await client
      .post(`/v1/tracks/${reference.id}/attempts`)
      .send(accurateRun)
      .expect(201);

    await refreshPersonalFeed(user.id);

    const response = await client.get('/v1/home').expect(200);
    const rows = response.body.rows as HomeRow[];
    const withinIds = idsIn(rows, 'within-your-voice');
    const challengeIds = idsIn(rows, 'challenge-your-range');

    expect(withinIds).toHaveLength(6);
    expect(new Set(withinIds)).toEqual(new Set(exact.map((track) => track.id)));
    expect(challengeIds).toHaveLength(6);
    expect(new Set(challengeIds)).toEqual(
      new Set(challenges.map((track) => track.id)),
    );
    expect(new Set([...withinIds, ...challengeIds]).size).toBe(12);
    const feedTrackIds = allTrackIds(rows);
    expect(new Set(feedTrackIds).size).toBe(feedTrackIds.length);
    expect(rows.find((row) => row.id === 'within-your-voice')).toMatchObject({
      title: { key: 'home.rows.withinYourVoice', params: {} },
    });
    expect(rows.find((row) => row.id === 'challenge-your-range')).toMatchObject(
      {
        title: { key: 'home.rows.challengeYourRange', params: {} },
      },
    );
  });

  it('omits both voice rows when no Attempt derives a range', async () => {
    const { reference } = await seedVoiceTracks();
    const { user, client } = await signInUser('no-range');
    await client
      .post(`/v1/tracks/${reference.id}/attempts`)
      .send(ordinaryRun)
      .expect(201);

    await refreshPersonalFeed(user.id);

    const response = await client.get('/v1/home').expect(200);
    const rowIds = (response.body.rows as HomeRow[]).map((row) => row.id);
    expect(rowIds).not.toContain('within-your-voice');
    expect(rowIds).not.toContain('challenge-your-range');
  });
});
