import { expectAdminRouteAccess } from './utils/admin-route-access.js';
import { useAuthSpec } from './utils/auth-spec.js';
import { signInPinsAdmin } from './utils/editorial-pin-factories.js';
import { createTrack, testMbid } from './utils/factories.js';
import {
  createCompletedTrack,
  createTrackProcessing,
} from './utils/track-processing-factories.js';

const SEARCH = '/v1/admin/tracks/search';

describe('Admin track search (e2e)', () => {
  const spec = useAuthSpec();

  describe('access', () => {
    it('refuses visitors and non-admin users', async () => {
      await expectAdminRouteAccess(
        spec.testApp,
        spec.client,
        `${SEARCH}?q=hit`,
      );
    });
  });

  describe('as an admin', () => {
    const mbid = testMbid(4242);

    beforeEach(async () => {
      await signInPinsAdmin(spec.testApp.db, spec.client);
    });

    const search = (query: string) =>
      spec.client.get(`${SEARCH}${query}`).expect(200);

    it('finds completed Tracks by title, hottest first, skipping queued ones', async () => {
      const cold = await createCompletedTrack(spec.testApp.db, {
        title: 'Summer hit',
        coverUrl: 'https://cdn.example/summer.webp',
        trendingScore: 10,
        artistCredit: [{ name: 'Beach Band', joinPhrase: '' }],
      });
      const hot = await createCompletedTrack(spec.testApp.db, {
        title: 'Summer anthem',
        trendingScore: 99,
        artistCredit: [{ name: 'Sun Singers', joinPhrase: '' }],
      });
      const queued = await createTrack(spec.testApp.db, {
        title: 'Summer demo',
      });
      await createTrackProcessing(spec.testApp.db, queued.id, {
        status: 'QUEUED',
      });
      await createCompletedTrack(spec.testApp.db, { title: 'Winter song' });

      const response = await search('?q=summer');

      expect(response.body).toEqual({
        items: [
          {
            id: hot.id,
            title: 'Summer anthem',
            artistCredit: [{ name: 'Sun Singers', joinPhrase: '' }],
            coverUrl: null,
          },
          {
            id: cold.id,
            title: 'Summer hit',
            artistCredit: [{ name: 'Beach Band', joinPhrase: '' }],
            coverUrl: 'https://cdn.example/summer.webp',
          },
        ],
      });
    });

    it('matches credited artist names and LIKE metacharacters literally', async () => {
      const credited = await createCompletedTrack(spec.testApp.db, {
        title: 'Unrelated title',
        artistCredit: [{ name: 'Queen', joinPhrase: '', mbid }],
      });
      await createCompletedTrack(spec.testApp.db, {
        title: '100% Hit',
        artistCredit: [{ name: 'Percent Band', joinPhrase: '' }],
      });

      const byArtist = await search('?q=queen');
      expect(
        byArtist.body.items.map((item: { id: string }) => item.id),
      ).toEqual([credited.id]);

      const byPercent = await search(`?q=${encodeURIComponent('100%')}`);
      expect(
        byPercent.body.items.map((item: { title: string }) => item.title),
      ).toEqual(['100% Hit']);
    });

    it('offers only Tracks with a cover for a hero', async () => {
      const covered = await createCompletedTrack(spec.testApp.db, {
        title: 'Hero hit',
        coverUrl: 'https://cdn.example/hero.webp',
      });
      await createCompletedTrack(spec.testApp.db, { title: 'Hero demo' });

      const response = await search(
        `?q=${encodeURIComponent('hero')}&kind=hero`,
      );

      expect(
        response.body.items.map((item: { id: string }) => item.id),
      ).toEqual([covered.id]);
    });

    it('resolves explicit IDs in order, skipping unknown ones', async () => {
      const first = await createCompletedTrack(spec.testApp.db, {
        title: 'First pick',
      });
      const second = await createCompletedTrack(spec.testApp.db, {
        title: 'Second pick',
      });

      const response = await search(`?ids=${second.id},nope,${first.id}`);

      expect(
        response.body.items.map((item: { id: string }) => item.id),
      ).toEqual([second.id, first.id]);
    });

    it('refuses a query with neither q nor ids, or both', async () => {
      await spec.client.get(SEARCH).expect(400);
      await spec.client.get(`${SEARCH}?q=hit&ids=abc`).expect(400);
      await spec.client.get(`${SEARCH}?q=`).expect(400);
    });
  });
});
