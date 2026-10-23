import type { TestingModuleBuilder } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { trackFavorites } from '../src/database/schema/track-favorites.js';
import { users } from '../src/database/schema/users.js';
import { HomeSocialService } from '../src/modules/home/home-social.service.js';
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
  private readonly entries = new Map<string, unknown>();

  async get<T>(key: string, schema: z.ZodType<T>): Promise<T | undefined> {
    const parsed = schema.safeParse(this.entries.get(key));
    return parsed.success ? parsed.data : undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.entries.set(key, value);
  }

  async acquire(): Promise<boolean> {
    return true;
  }

  async del(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

const withMemoryCache = (builder: TestingModuleBuilder) =>
  builder.overrideProvider(CacheService).useValue(new MemoryCache());

describe('Personal home social rows (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ override: withMemoryCache });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => resetDatabase(testApp.db));

  it('requires three common Tracks and excludes Profiles that hide both sections', async () => {
    const tracks = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        createCompletedTrack(testApp.db, { title: `Social track ${index}` }),
      ),
    );
    const viewer = await createUser(testApp.db, {
      username: 'social_viewer',
      email: 'social-viewer@example.com',
    });
    await createCredentialAccount(testApp.db, viewer);
    const addFavorites = (userId: string, trackIds: string[]) =>
      testApp.db
        .insert(trackFavorites)
        .values(trackIds.map((trackId) => ({ userId, trackId })));
    await addFavorites(
      viewer.id,
      tracks.map((track) => track.id),
    );
    const client = createAuthClient(testApp);
    await signIn(client, {
      email: viewer.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);

    const people = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        createUser(testApp.db, {
          username: `social_person_${index}`,
          email: `social-person-${index}@example.com`,
        }),
      ),
    );
    const hidden = await createUser(testApp.db, {
      username: 'social_hidden',
      email: 'social-hidden@example.com',
    });
    const trackIds = tracks.map((track) => track.id);
    await Promise.all(
      [...people, hidden].map((person) => addFavorites(person.id, trackIds)),
    );
    const tooFew = await createUser(testApp.db, {
      username: 'social_too_few',
      email: 'social-too-few@example.com',
    });
    await addFavorites(tooFew.id, trackIds.slice(0, 2));
    await testApp.app.get(HomeSocialService).refreshFor(viewer.id);
    await testApp.db
      .update(users)
      .set({ showPracticeHistorySection: false, showFavoritesSection: false })
      .where(eq(users.id, hidden.id));

    const response = await client.get('/v1/home').expect(200);
    const rows = response.body.rows as {
      id: string;
      layout: string;
      items?: { username: string; commonTracks: number }[];
    }[];
    const peopleRows = rows.filter((row) => row.layout === 'people');

    expect(peopleRows).toHaveLength(2);
    for (const row of peopleRows) {
      expect(row.items).toHaveLength(6);
      expect(row.items?.every((person) => person.commonTracks === 3)).toBe(
        true,
      );
      expect(
        row.items?.some((person) => person.username === 'social_hidden'),
      ).toBe(false);
      expect(
        row.items?.some((person) => person.username === 'social_too_few'),
      ).toBe(false);
      expect(
        row.items?.some((person) => person.username === 'social_viewer'),
      ).toBe(false);
    }
  });
});
