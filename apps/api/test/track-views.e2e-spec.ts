import { getQueueToken } from '@nestjs/bullmq';
import { trackDetailSchema, trackViewSchema } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { trackViews } from '../src/database/schema/track-views.js';
import { tracks } from '../src/database/schema/tracks.js';
import { TrackTrendingProcessor } from '../src/modules/tracks/track-trending.processor.js';
import {
  TRACK_TRENDING_QUEUE,
  UPDATE_TRACK_TRENDING_JOB,
} from '../src/modules/tracks/track-views.job.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createTrack,
  createUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

const trendingJobs: { name: string; data: unknown; options: unknown }[] = [];
const trendingQueue = {
  add: async (name: string, data: unknown, options: unknown) => {
    trendingJobs.push({ name, data, options });
    return { id: String(trendingJobs.length) };
  },
  getJob: async () => undefined,
};

const spec = useAuthSpec({
  override: (builder) =>
    builder
      .overrideProvider(getQueueToken(TRACK_TRENDING_QUEUE))
      .useValue(trendingQueue)
      .overrideProvider(TrackTrendingProcessor)
      .useValue({}),
});

describe('Track views (e2e)', () => {
  let user: User;

  beforeEach(async () => {
    user = await createUser(spec.testApp.db, { username: 'grace' });
    await createCredentialAccount(spec.testApp.db, user);
  });

  it('creates an anonymous view once and schedules a delayed score update', async () => {
    const track = await createTrack(spec.testApp.db);
    const path = `/v1/tracks/${track.id}/views`;
    const first = await request(spec.testApp.app.getHttpServer())
      .post(path)
      .expect(200);
    const view = trackViewSchema.parse(first.body);
    await request(spec.testApp.app.getHttpServer())
      .post(path)
      .send(view)
      .expect(200, view);

    const rows = await spec.testApp.db
      .select()
      .from(trackViews)
      .where(eq(trackViews.trackId, track.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBeNull();
    expect(trendingJobs.at(-1)).toMatchObject({
      name: UPDATE_TRACK_TRENDING_JOB,
      data: { trackId: track.id },
      options: { delay: 30_000 },
    });
  });

  it('attaches an anonymous view when its User signs in later', async () => {
    const track = await createTrack(spec.testApp.db);
    const anonymous = await request(spec.testApp.app.getHttpServer())
      .post(`/v1/tracks/${track.id}/views`)
      .expect(200);
    const view = trackViewSchema.parse(anonymous.body);

    await signIn(spec.client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    await spec.client
      .post(`/v1/tracks/${track.id}/views`)
      .send(view)
      .expect(200, view);

    const [row] = await spec.testApp.db
      .select()
      .from(trackViews)
      .where(eq(trackViews.id, view.viewId));
    expect(row?.userId).toBe(user.id);
  });

  it('rejects an unknown session view ID', async () => {
    const track = await createTrack(spec.testApp.db);

    await request(spec.testApp.app.getHttpServer())
      .post(`/v1/tracks/${track.id}/views`)
      .send({ viewId: 'unknown-view' })
      .expect(404);
  });

  it('returns the view count and only completed Tracks in trending order', async () => {
    const lower = await createCompletedTrack(spec.testApp.db);
    const higher = await createCompletedTrack(spec.testApp.db);
    const incomplete = await createTrack(spec.testApp.db);
    await spec.testApp.db
      .update(tracks)
      .set({ trendingScore: 10 })
      .where(eq(tracks.id, lower.id));
    await spec.testApp.db
      .update(tracks)
      .set({ trendingScore: 20 })
      .where(eq(tracks.id, higher.id));
    await request(spec.testApp.app.getHttpServer())
      .post(`/v1/tracks/${lower.id}/views`)
      .expect(200);

    const details = await request(spec.testApp.app.getHttpServer())
      .get(`/v1/tracks/${lower.id}`)
      .expect(200);
    expect(trackDetailSchema.parse(details.body).viewCount).toBe(1);
    const sitemap = await request(spec.testApp.app.getHttpServer())
      .get('/v1/tracks/sitemap.xml')
      .expect(200);
    expect(sitemap.body.trackIds).toEqual([higher.id, lower.id]);
    expect(sitemap.body.trackIds).not.toContain(incomplete.id);
  });
});
