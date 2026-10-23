import type { Job } from 'bullmq';
import request from 'supertest';
import { events } from '../src/database/schema/events.js';
import { practiceAttempts } from '../src/database/schema/practice-attempts.js';
import { practiceHeartbeats } from '../src/database/schema/practice-heartbeats.js';
import { trackViews } from '../src/database/schema/track-views.js';
import { EVENTS_QUEUE } from '../src/modules/events/events.job.js';
import { EventsProcessor } from '../src/modules/events/events.processor.js';
import { EventsRepository } from '../src/modules/events/events.repository.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createTrack,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';

describe('home click to Track practice attribution (e2e)', () => {
  const spec = useAuthSpec();
  const clickId = 'home-click-1';

  const recordClick = async (trackId: string) => {
    await request(spec.testApp.app.getHttpServer())
      .post('/v1/events')
      .send({
        visitorId: 'visitor-home-1',
        events: [
          {
            type: 'home.item_click',
            clickId,
            rowId: 'trending',
            feedVersion: 'a1b2c3d4e5f60718',
            algorithmVersion: 1,
            itemId: trackId,
            position: 0,
          },
        ],
      })
      .expect(202);
    const job = spec.testApp.queues[EVENTS_QUEUE]?.added.shift();
    if (job === undefined) throw new Error('No events job was queued');
    await new EventsProcessor(spec.testApp.app.get(EventsRepository)).process(
      job as Job<unknown>,
    );
  };

  it('stores the same click id on the event, view, heartbeat and attempt', async () => {
    const user = await createUser(spec.testApp.db, { username: 'grace' });
    await createCredentialAccount(spec.testApp.db, user);
    await signIn(spec.client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    const track = await createTrack(spec.testApp.db);

    await recordClick(track.id);
    const clickEvent = (await spec.testApp.db.select().from(events))[0];
    expect(clickEvent).toMatchObject({
      type: 'home.item_click',
      clickId,
      payload: { clickId },
    });

    const viewResponse = await spec.client
      .post(`/v1/tracks/${track.id}/views`)
      .send({ clickId, locale: 'en' })
      .expect(201);
    const viewId = viewResponse.body.viewId as string;
    expect(await spec.testApp.db.select().from(trackViews)).toMatchObject([
      { id: viewId, clickId, userId: user.id },
    ]);

    await spec.client
      .post('/v1/me/streak/heartbeat')
      .send({ elapsedSeconds: 5, timeZone: 'UTC', viewId })
      .expect(200);
    expect(
      await spec.testApp.db.select().from(practiceHeartbeats),
    ).toMatchObject([
      { userId: user.id, viewId, elapsedSeconds: 5, creditedSeconds: 5 },
    ]);

    await spec.client
      .post(`/v1/tracks/${track.id}/attempts`)
      .send({
        difficulty: 'NORMAL',
        octaveMode: 'ANY',
        transposeSemitones: 0,
        speed: 1,
        accuracy: 0.8,
        coverage: 0.95,
        forwardSkip: false,
        bleedSuspected: false,
        startedAt: '2026-10-22T10:00:00.000Z',
        endedAt: '2026-10-22T10:04:00.000Z',
        viewId,
      })
      .expect(201);
    expect(await spec.testApp.db.select().from(practiceAttempts)).toMatchObject(
      [{ userId: user.id, trackId: track.id, viewId }],
    );
  });

  it('records views without a click id and with an unknown click id', async () => {
    const track = await createTrack(spec.testApp.db);
    const client = request(spec.testApp.app.getHttpServer());

    await client.post(`/v1/tracks/${track.id}/views`).send({}).expect(201);
    await client
      .post(`/v1/tracks/${track.id}/views`)
      .send({ clickId: 'unknown-click' })
      .expect(201);

    expect(
      (
        await spec.testApp.db
          .select({ clickId: trackViews.clickId })
          .from(trackViews)
      ).map((view) => view.clickId),
    ).toEqual([null, 'unknown-click']);
  });
});
