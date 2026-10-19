import {
  cacheTags,
  type ProfileVisibility,
  profileVisibilitySchema,
} from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { users } from '../src/database/schema/users.js';
import {
  WEB_REVALIDATION_JOB,
  WEB_REVALIDATION_QUEUE,
} from '../src/integrations/web-revalidation/web-revalidation.job.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';

const ALL_VISIBLE: ProfileVisibility = {
  summary: true,
  practiceHistory: true,
  favorites: true,
};

// Visitors read the three sections of a Profile. Each one answers 200 while
// shown; the sections are empty here, which is what a visitor can tell apart
// only by the status, never by data.
const SECTION_READS = [
  '/v1/users/grace/summary',
  '/v1/users/grace/attempts',
  '/v1/users/grace/favorites',
] as const;

describe('Profile sections visibility (e2e)', () => {
  const spec = useAuthSpec();
  let owner: User;

  const revalidations = () =>
    spec.testApp.queues[WEB_REVALIDATION_QUEUE]?.added ?? [];

  const signInAsOwner = async () => {
    owner = await createUser(spec.testApp.db, {
      name: 'Grace Hopper',
      email: 'grace@example.com',
      username: 'grace',
    });
    await createCredentialAccount(spec.testApp.db, owner);
    await signIn(spec.client, {
      email: owner.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  };

  const visitorRead = (path: string) =>
    request(spec.testApp.app.getHttpServer()).get(path);

  const hide = (flags: Partial<ProfileVisibility>) =>
    spec.client.patch('/v1/me/profile-visibility').send(flags);

  beforeEach(async () => {
    revalidations().length = 0;
    await signInAsOwner();
  });

  describe('defaults', () => {
    it('shows every section to everyone, for a new User', async () => {
      const response = await spec.client
        .get('/v1/me/profile-visibility')
        .expect(200);

      expect(profileVisibilitySchema.parse(response.body)).toEqual(ALL_VISIBLE);
      for (const path of SECTION_READS) {
        await visitorRead(path).expect(200);
      }
    });

    it('stores the default on the row of a legacy import', async () => {
      const [row] = await spec.testApp.db
        .select({
          summary: users.showSummarySection,
          practiceHistory: users.showPracticeHistorySection,
          favorites: users.showFavoritesSection,
        })
        .from(users)
        .where(eq(users.id, owner.id));

      expect(row).toEqual(ALL_VISIBLE);
    });
  });

  describe('who can change it', () => {
    it('answers UNAUTHORIZED to a read without a session', async () => {
      const response = await request(spec.testApp.app.getHttpServer())
        .get('/v1/me/profile-visibility')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    });

    it('answers UNAUTHORIZED to a change without a session', async () => {
      const response = await request(spec.testApp.app.getHttpServer())
        .patch('/v1/me/profile-visibility')
        .send({ summary: false })
        .expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
      expect(revalidations()).toEqual([]);
    });
  });

  describe('changing a section', () => {
    it('updates only the flag sent and returns every flag', async () => {
      const response = await hide({ practiceHistory: false }).expect(200);

      expect(response.body).toEqual({
        summary: true,
        practiceHistory: false,
        favorites: true,
      });
      const read = await spec.client
        .get('/v1/me/profile-visibility')
        .expect(200);
      expect(read.body).toEqual(response.body);
    });

    it('keeps the stored flags when the body is empty', async () => {
      await hide({ favorites: false }).expect(200);

      const response = await hide({}).expect(200);

      expect(response.body).toEqual({
        summary: true,
        practiceHistory: true,
        favorites: false,
      });
    });

    it('refuses a flag that is not a boolean', async () => {
      const response = await spec.client
        .patch('/v1/me/profile-visibility')
        .send({ summary: 'no' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });

    it('refreshes the cached Profile and Favorite songs', async () => {
      await hide({ favorites: false }).expect(200);

      expect(revalidations()).toEqual([
        {
          name: WEB_REVALIDATION_JOB,
          data: {
            tags: [
              cacheTags.userProfile('grace'),
              cacheTags.userFavorites('grace'),
            ],
          },
        },
      ]);
    });
  });

  describe('what a visitor receives', () => {
    it('answers NOT_FOUND for each hidden section and nothing else', async () => {
      await hide({ summary: false, practiceHistory: false, favorites: false });

      for (const path of SECTION_READS) {
        const response = await visitorRead(path).expect(404);
        expect(response.body).toMatchObject({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Section not found',
        });
      }
      await visitorRead('/v1/users/grace').expect(200);
    });

    it('still reads a shown section next to a hidden one', async () => {
      await hide({ practiceHistory: false }).expect(200);

      await visitorRead('/v1/users/grace/summary').expect(200);
      await visitorRead('/v1/users/grace/favorites').expect(200);
      await visitorRead('/v1/users/grace/attempts').expect(404);
    });

    it('answers NOT_FOUND for an unknown username, as before', async () => {
      const response = await visitorRead('/v1/users/nobody/attempts').expect(
        404,
      );

      expect(response.body).toMatchObject({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    });
  });

  describe('what the owner receives', () => {
    it('still reads a section the owner hid, through the session', async () => {
      await hide({
        summary: false,
        practiceHistory: false,
        favorites: false,
      }).expect(200);

      for (const path of SECTION_READS) {
        await spec.client.get(path).expect(200);
      }
    });
  });

  describe('which sections a visitor sees', () => {
    it('answers the flags a visitor sees, to anyone and without any data', async () => {
      await hide({ practiceHistory: false }).expect(200);

      const response = await visitorRead('/v1/users/grace/sections').expect(
        200,
      );

      expect(response.body).toEqual({
        summary: true,
        practiceHistory: false,
        favorites: true,
      });
    });

    it('answers NOT_FOUND for an unknown username', async () => {
      await visitorRead('/v1/users/nobody/sections').expect(404);
    });
  });

  // The Summary section stays shown while one of its counters belongs to a
  // hidden section: that counter must not reach a visitor, even though the
  // rest of the Summary does.
  describe('counters of a hidden section inside a shown Summary', () => {
    it('hides the Favorites counter when Favorites is hidden', async () => {
      await hide({ favorites: false }).expect(200);

      const response = await visitorRead('/v1/users/grace/summary').expect(200);

      expect(response.body).toMatchObject({ favoritesCount: null });
      expect(response.body).toMatchObject({ sungCount: 0 });
    });

    it('hides the Sung counter when Practice history is hidden', async () => {
      await hide({ practiceHistory: false }).expect(200);

      const response = await visitorRead('/v1/users/grace/summary').expect(200);

      expect(response.body).toMatchObject({ sungCount: null });
      expect(response.body).toMatchObject({ favoritesCount: 0 });
    });

    it('keeps every counter for the owner', async () => {
      await hide({ favorites: false, practiceHistory: false }).expect(200);

      const response = await spec.client
        .get('/v1/users/grace/summary')
        .expect(200);

      expect(response.body).toMatchObject({
        sungCount: 0,
        favoritesCount: 0,
      });
    });
  });
});
