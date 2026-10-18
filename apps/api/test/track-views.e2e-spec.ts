import {
  cacheTags,
  trackDetailSchema,
  trackSitemapPageSchema,
  trackViewSchema,
} from '@notefinder/contracts';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { trackViews } from '../src/database/schema/track-views.js';
import { tracks } from '../src/database/schema/tracks.js';
import {
  REFRESH_SCORED_TRACKS_JOB,
  REFRESH_TRENDING_SCORE_JOB,
  TRACK_TRENDING_QUEUE,
} from '../src/modules/tracks/track-trending.job.js';
import { TrackTrendingProcessor } from '../src/modules/tracks/track-trending.processor.js';
import { TrackTrendingService } from '../src/modules/tracks/track-trending.service.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createTrack,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';
import {
  createCompletedTrack,
  createLegacyTrackId,
} from './utils/track-processing-factories.js';
import { createTrackView } from './utils/track-view-factories.js';

// POST /v1/tracks/:trackId/views is public: a visitor's visit counts, and the
// browser keeps the returned ID to attach the User if they sign in later. The
// trending score is recomputed by a delayed job, and the Tracks sitemap lists
// the completed Tracks by that score.
describe('Track views and trending (e2e)', () => {
  const spec = useAuthSpec();

  const anonymous = () => request(spec.testApp.app.getHttpServer());

  const viewsOf = (trackId: string) =>
    spec.testApp.db
      .select({ id: trackViews.id, userId: trackViews.userId })
      .from(trackViews)
      .where(eq(trackViews.trackId, trackId));

  const scoreOf = async (trackId: string) => {
    const [row] = await spec.testApp.db
      .select({ score: tracks.trendingScore })
      .from(tracks)
      .where(eq(tracks.id, trackId));
    return row?.score;
  };

  const trendingJobs = () => spec.testApp.queues[TRACK_TRENDING_QUEUE]?.added;

  describe('POST /v1/tracks/:trackId/views', () => {
    it('records the view of a visitor and answers its ID with 201', async () => {
      const track = await createTrack(spec.testApp.db);

      const response = await anonymous()
        .post(`/v1/tracks/${track.id}/views`)
        .send({})
        .expect(201);

      const { viewId } = trackViewSchema.parse(response.body);
      expect(await viewsOf(track.id)).toEqual([{ id: viewId, userId: null }]);
    });

    it('records the signed-in User with their view', async () => {
      const user = await createUser(spec.testApp.db, { username: 'grace' });
      await createCredentialAccount(spec.testApp.db, user);
      await signIn(spec.client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);
      const track = await createTrack(spec.testApp.db);

      await spec.client
        .post(`/v1/tracks/${track.id}/views`)
        .send({})
        .expect(201);

      expect(await viewsOf(track.id)).toMatchObject([{ userId: user.id }]);
    });

    it('attaches the User who signs in later to the stored view, recording nothing new', async () => {
      const track = await createTrack(spec.testApp.db);
      const first = await spec.client
        .post(`/v1/tracks/${track.id}/views`)
        .send({})
        .expect(201);
      const { viewId } = trackViewSchema.parse(first.body);
      const user = await createUser(spec.testApp.db, { username: 'grace' });
      await createCredentialAccount(spec.testApp.db, user);
      await signIn(spec.client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);

      const second = await spec.client
        .post(`/v1/tracks/${track.id}/views`)
        .send({ viewId })
        .expect(200);

      expect(second.body).toEqual({ viewId });
      expect(await viewsOf(track.id)).toEqual([
        { id: viewId, userId: user.id },
      ]);
    });

    it('leaves a view that already has a User with that User', async () => {
      const owner = await createUser(spec.testApp.db, { username: 'ada' });
      const track = await createTrack(spec.testApp.db);
      const view = await createTrackView(spec.testApp.db, track.id, {
        userId: owner.id,
      });
      const other = await createUser(spec.testApp.db, { username: 'grace' });
      await createCredentialAccount(spec.testApp.db, other);
      await signIn(spec.client, {
        email: other.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);

      await spec.client
        .post(`/v1/tracks/${track.id}/views`)
        .send({ viewId: view.id })
        .expect(200);

      expect(await viewsOf(track.id)).toEqual([
        { id: view.id, userId: owner.id },
      ]);
    });

    it('records a new view for an ID that names no view of the Track', async () => {
      const track = await createTrack(spec.testApp.db);
      const other = await createTrack(spec.testApp.db);
      const foreign = await anonymous()
        .post(`/v1/tracks/${other.id}/views`)
        .send({})
        .expect(201);

      const unknown = await anonymous()
        .post(`/v1/tracks/${track.id}/views`)
        .send({ viewId: 'stale-view-id' })
        .expect(201);
      const crossed = await anonymous()
        .post(`/v1/tracks/${track.id}/views`)
        .send({ viewId: foreign.body.viewId })
        .expect(201);

      expect(unknown.body.viewId).not.toBe('stale-view-id');
      expect(crossed.body.viewId).not.toBe(foreign.body.viewId);
      expect(await viewsOf(track.id)).toHaveLength(2);
      expect(await viewsOf(other.id)).toHaveLength(1);
    });

    it('answers 400 VALIDATION_FAILED for a view ID that is too long', async () => {
      const track = await createTrack(spec.testApp.db);

      const response = await anonymous()
        .post(`/v1/tracks/${track.id}/views`)
        .send({ viewId: 'x'.repeat(129) })
        .expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { location: 'body' },
      });
    });

    it('answers 404 NOT_FOUND for an unknown Track', async () => {
      const response = await anonymous()
        .post('/v1/tracks/nope/views')
        .send({})
        .expect(404);

      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('answers a legacy Track ID with 404 RESOURCE_MOVED and the new ID', async () => {
      const track = await createTrack(spec.testApp.db);
      await createLegacyTrackId(spec.testApp.db, track.id, 'legacy-track');

      const response = await anonymous()
        .post('/v1/tracks/legacy-track/views')
        .send({})
        .expect(404);

      expect(response.body).toMatchObject({
        code: 'RESOURCE_MOVED',
        details: { id: track.id },
      });
      expect(await viewsOf(track.id)).toEqual([]);
    });

    it('schedules the delayed trending refresh of the Track', async () => {
      const track = await createTrack(spec.testApp.db);
      const queue = spec.testApp.queues[TRACK_TRENDING_QUEUE];
      queue?.added.splice(0);

      await anonymous()
        .post(`/v1/tracks/${track.id}/views`)
        .send({})
        .expect(201);

      expect(trendingJobs()).toEqual([
        { name: REFRESH_TRENDING_SCORE_JOB, data: { trackId: track.id } },
      ]);
    });
  });

  describe('the view count', () => {
    it('shows in the Track header, one per recorded view', async () => {
      const track = await createTrack(spec.testApp.db);
      await anonymous()
        .post(`/v1/tracks/${track.id}/views`)
        .send({})
        .expect(201);
      await anonymous()
        .post(`/v1/tracks/${track.id}/views`)
        .send({})
        .expect(201);

      const response = await anonymous()
        .get(`/v1/tracks/${track.id}`)
        .expect(200);

      expect(trackDetailSchema.parse(response.body).viewCount).toBe(2);
    });
  });

  describe('the trending score', () => {
    /** Runs the oldest job queued in the trending queue, as its worker would. */
    const runQueuedJob = async () => {
      const job = spec.testApp.queues[TRACK_TRENDING_QUEUE]?.added.shift();
      if (job === undefined) throw new Error('No trending job was queued');
      const processor = new TrackTrendingProcessor(
        spec.testApp.app.get(TrackTrendingService),
      );
      await processor.process(job as Job<unknown>);
    };

    it('is 0 until the queued job runs, then follows the views', async () => {
      const track = await createTrack(spec.testApp.db);
      spec.testApp.queues[TRACK_TRENDING_QUEUE]?.added.splice(0);
      for (let n = 0; n < 3; n++) {
        await anonymous()
          .post(`/v1/tracks/${track.id}/views`)
          .send({})
          .expect(201);
      }
      expect(await scoreOf(track.id)).toBe(0);

      await runQueuedJob();

      // Three views this hour: base = 3 * (1.5 + 1.2 + 1.1 + 1) = 14.4,
      // log10(4) = 0.602, and a boost of at least 1.
      expect(await scoreOf(track.id)).toBeGreaterThanOrEqual(9);
    });

    it('asks the web to revalidate the Track, and not the sitemap', async () => {
      const track = await createTrack(spec.testApp.db);
      const revalidations = spec.testApp.queues['web-revalidation']?.added;
      revalidations?.splice(0);

      await spec.testApp.app.get(TrackTrendingService).refresh(track.id);

      expect(revalidations).toEqual([
        {
          name: expect.any(String),
          data: { tags: [cacheTags.track(track.id)] },
        },
      ]);
    });

    it('ranks a Track viewed more above one viewed less', async () => {
      const quiet = await createTrack(spec.testApp.db);
      const busy = await createTrack(spec.testApp.db);
      await createTrackView(spec.testApp.db, quiet.id);
      for (let n = 0; n < 6; n++) {
        await createTrackView(spec.testApp.db, busy.id);
      }
      const trending = spec.testApp.app.get(TrackTrendingService);

      await trending.refresh(quiet.id);
      await trending.refresh(busy.id);

      expect(await scoreOf(busy.id)).toBeGreaterThan(
        (await scoreOf(quiet.id)) ?? 0,
      );
    });

    it('falls to 0 on the daily run once the views of a Track stop', async () => {
      const stale = await createTrack(spec.testApp.db);
      const live = await createTrack(spec.testApp.db);
      // Scored a month ago: no view since, so every window has rolled.
      await createTrackView(spec.testApp.db, stale.id, {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      await createTrackView(spec.testApp.db, live.id);
      await spec.testApp.db.update(tracks).set({ trendingScore: 500 });
      const revalidations = spec.testApp.queues['web-revalidation']?.added;
      revalidations?.splice(0);
      const queue = spec.testApp.queues[TRACK_TRENDING_QUEUE];
      queue?.added.splice(0);
      queue?.added.push({ name: REFRESH_SCORED_TRACKS_JOB, data: {} });

      await runQueuedJob();

      expect(await scoreOf(stale.id)).toBe(0);
      expect(await scoreOf(live.id)).toBeGreaterThan(0);
      expect(revalidations).toEqual([
        { name: expect.any(String), data: { tags: [cacheTags.sitemap] } },
      ]);
    });
  });

  describe('GET /v1/sitemaps/tracks', () => {
    it('lists the completed Tracks by trending score, highest first, and no others', async () => {
      const low = await createCompletedTrack(spec.testApp.db, {});
      const high = await createCompletedTrack(spec.testApp.db, {});
      await createTrack(spec.testApp.db);
      await spec.testApp.db
        .update(tracks)
        .set({ trendingScore: 10 })
        .where(eq(tracks.id, low.id));
      await spec.testApp.db
        .update(tracks)
        .set({ trendingScore: 50 })
        .where(eq(tracks.id, high.id));

      const response = await anonymous().get('/v1/sitemaps/tracks').expect(200);

      const page = trackSitemapPageSchema.parse(response.body);
      expect(page.items.map((item) => item.id)).toEqual([high.id, low.id]);
      expect(page.nextCursor).toBeNull();
    });

    it('lists each Track cover, and null for a Track without one', async () => {
      const covered = await createCompletedTrack(spec.testApp.db, {
        coverUrl: 'https://files.example.com/covers/covered.webp',
      });
      const bare = await createCompletedTrack(spec.testApp.db, {});

      const response = await anonymous().get('/v1/sitemaps/tracks').expect(200);

      const page = trackSitemapPageSchema.parse(response.body);
      const covers = new Map(
        page.items.map((item) => [item.id, item.coverUrl]),
      );
      expect(covers.get(covered.id)).toBe(
        'https://files.example.com/covers/covered.webp',
      );
      expect(covers.get(bare.id)).toBeNull();
    });

    it('pages with cursors, ties broken by Track ID', async () => {
      const first = await createCompletedTrack(spec.testApp.db, {});
      const second = await createCompletedTrack(spec.testApp.db, {});
      const third = await createCompletedTrack(spec.testApp.db, {});
      await spec.testApp.db.update(tracks).set({ trendingScore: 7 });
      const expected = [first.id, second.id, third.id].sort();

      const one = await anonymous()
        .get('/v1/sitemaps/tracks?limit=2')
        .expect(200);
      const pageOne = trackSitemapPageSchema.parse(one.body);
      const two = await anonymous()
        .get(`/v1/sitemaps/tracks?limit=2&cursor=${pageOne.nextCursor}`)
        .expect(200);
      const pageTwo = trackSitemapPageSchema.parse(two.body);

      expect(pageOne.items.map((item) => item.id)).toEqual(
        expected.slice(0, 2),
      );
      expect(pageTwo.items.map((item) => item.id)).toEqual(expected.slice(2));
      expect(pageTwo.nextCursor).toBeNull();
    });

    it('answers 400 VALIDATION_FAILED for a cursor it did not issue', async () => {
      const response = await anonymous()
        .get('/v1/sitemaps/tracks?cursor=nope')
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });
});
