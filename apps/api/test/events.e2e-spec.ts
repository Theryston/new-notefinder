import { recordEventsResponseSchema } from '@notefinder/contracts';
import type { Job } from 'bullmq';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { events } from '../src/database/schema/events.js';
import { EVENTS_QUEUE } from '../src/modules/events/events.job.js';
import { EventsProcessor } from '../src/modules/events/events.processor.js';
import { EventsRepository } from '../src/modules/events/events.repository.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';

// POST /v1/events is public: an anonymous batch carries only the visitor id,
// a signed-in one also stores the User. The endpoint answers 202 at once and
// a job stores the batch later, with one INSERT per batch, in the
// monthly-partitioned table.
describe('Events ingestion (e2e)', () => {
  const spec = useAuthSpec();

  const anonymous = () => request(spec.testApp.app.getHttpServer());

  const impression = (rowId: string, position = 0) => ({
    type: 'home.row_impression',
    rowId,
    feedVersion: 'a1b2c3d4e5f60718',
    algorithmVersion: 1,
    items: [{ id: 'track-1', position }],
  });

  const click = {
    type: 'home.item_click',
    rowId: 'row-0',
    feedVersion: 'a1b2c3d4e5f60718',
    algorithmVersion: 1,
    itemId: 'track-2',
    position: 2,
  };

  /** Runs the oldest queued batch as its worker would. */
  const runQueuedBatch = async () => {
    const job = spec.testApp.queues[EVENTS_QUEUE]?.added.shift();
    if (job === undefined) throw new Error('No events job was queued');
    const processor = new EventsProcessor(
      spec.testApp.app.get(EventsRepository),
    );
    await processor.process(job as Job<unknown>);
  };

  const rowsOf = () => spec.testApp.db.select().from(events);

  const batched = (count: number) => ({
    visitorId: 'visitor-1',
    events: Array.from({ length: count }, (_, index) =>
      impression(`row-${index % 4}`),
    ),
  });

  describe('POST /v1/events', () => {
    it('accepts a valid batch with 202 and stores it once the job runs', async () => {
      const response = await anonymous()
        .post('/v1/events')
        .send({ visitorId: 'visitor-1', events: [impression('row-0'), click] })
        .expect(202);

      expect(recordEventsResponseSchema.parse(response.body)).toEqual({
        accepted: 2,
      });
      // The response went out before anything was stored.
      expect(await rowsOf()).toHaveLength(0);

      await runQueuedBatch();

      const rows = await rowsOf();
      expect(rows).toHaveLength(2);
      expect(rows).toMatchObject([
        { type: 'home.row_impression', rowId: 'row-0', userId: null },
        { type: 'home.item_click', itemId: 'track-2', userId: null },
      ]);
      expect(rows[0]?.payload).toMatchObject({ type: 'home.row_impression' });
    });

    it('stores the signed-in User with the batch', async () => {
      const user = await createUser(spec.testApp.db, { username: 'ivan' });
      await createCredentialAccount(spec.testApp.db, user);
      await signIn(spec.client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);

      await spec.client
        .post('/v1/events')
        .send({ visitorId: 'visitor-1', events: [impression('row-1')] })
        .expect(202);
      await runQueuedBatch();

      expect(await rowsOf()).toMatchObject([{ userId: user.id }]);
    });

    it('refuses an oversized batch', async () => {
      const response = await anonymous()
        .post('/v1/events')
        .send(batched(51))
        .expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { location: 'body' },
      });
      expect(spec.testApp.queues[EVENTS_QUEUE]?.added).toHaveLength(0);
    });

    it('refuses an invalid event', async () => {
      const response = await anonymous()
        .post('/v1/events')
        .send({
          visitorId: 'visitor-1',
          events: [{ type: 'home.something_else', rowId: 'row-0' }],
        })
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(spec.testApp.queues[EVENTS_QUEUE]?.added).toHaveLength(0);
    });

    it('drops a bot batch after the 202, queueing nothing', async () => {
      const response = await anonymous()
        .post('/v1/events')
        .set(
          'User-Agent',
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        )
        .send({ visitorId: 'visitor-1', events: [impression('row-0')] })
        .expect(202);

      expect(recordEventsResponseSchema.parse(response.body)).toEqual({
        accepted: 0,
      });
      expect(spec.testApp.queues[EVENTS_QUEUE]?.added).toHaveLength(0);
    });

    it('applies the per-IP rate limit', async () => {
      const probe = () =>
        anonymous()
          .post('/v1/events')
          .set('X-Forwarded-For', '203.0.113.77')
          .send({ visitorId: 'visitor-9', events: [impression('row-0')] });

      for (let n = 0; n < 30; n++) {
        await probe().expect(202);
      }
      const limited = await probe().expect(429);
      expect(limited.body).toMatchObject({ code: 'RATE_LIMITED' });
    });
  });

  describe('the partitioned events table', () => {
    const monthPartition = () => {
      const now = new Date();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      return `events_${now.getUTCFullYear()}_${month}`;
    };

    it('has a partition for the current month', async () => {
      const result = await spec.testApp.db.execute<{ tablename: string }>(sql`
        select tablename from pg_tables
        where schemaname = 'public' and tablename = ${monthPartition()}
      `);

      expect(result.rows.map((row) => row.tablename)).toEqual([
        monthPartition(),
      ]);
    });
  });
});
