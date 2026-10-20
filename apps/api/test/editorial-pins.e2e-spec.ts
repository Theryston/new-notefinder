import request from 'supertest';
import { WEB_REVALIDATION_QUEUE } from '../src/integrations/web-revalidation/web-revalidation.job.js';
import { EDITORIAL_PIN_QUEUE } from '../src/modules/editorial-pins/editorial-pins.job.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  heroPinBody,
  rowPinBody,
  signInPinsAdmin,
} from './utils/editorial-pin-factories.js';
import {
  createCredentialAccount,
  createTrack,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';
import {
  createCompletedTrack,
  createTrackProcessing,
} from './utils/track-processing-factories.js';

const PINS = '/v1/admin/home-pins';

/** A Track whose Processing is still queued: it cannot appear in a pin. */
const queuedTrack = async (db: Parameters<typeof createTrack>[0]) => {
  const track = await createTrack(db, { title: 'Still queued' });
  await createTrackProcessing(db, track.id, { status: 'QUEUED' });
  return track;
};

describe('Editorial pins (e2e)', () => {
  const spec = useAuthSpec();
  const anonymous = () => request(spec.testApp.app.getHttpServer());

  /** A signed-in admin; the spec's client carries the session. */
  const signInAdmin = () => signInPinsAdmin(spec.testApp.db, spec.client);

  const createPin = async (body: Record<string, unknown>) => {
    const response = await spec.client.post(PINS).send(body).expect(201);
    return response.body as { id: string };
  };

  const revalidatedTags = (): string[] =>
    (spec.testApp.queues[WEB_REVALIDATION_QUEUE]?.added ?? []).flatMap(
      (job) => (job.data as { tags: string[] }).tags,
    );

  describe('access', () => {
    it('refuses a visitor on every pin route', async () => {
      const id = 'some-pin';
      await anonymous().get(PINS).expect(401);
      await anonymous()
        .post(PINS)
        .send(rowPinBody(['t']))
        .expect(401);
      await anonymous().get(`${PINS}/${id}`).expect(401);
      await anonymous().patch(`${PINS}/${id}`).send({}).expect(401);
      await anonymous().delete(`${PINS}/${id}`).expect(401);
      await anonymous().get(`${PINS}/${id}/history`).expect(401);
    });

    it('refuses a signed-in User who is not an admin on every pin route', async () => {
      const user = await createUser(spec.testApp.db, {
        username: 'plain-user',
        email: 'plain-user@example.com',
      });
      await createCredentialAccount(spec.testApp.db, user);
      await signIn(spec.client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);

      const response = await spec.client.get(PINS).expect(403);
      expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
      await spec.client
        .post(PINS)
        .send(rowPinBody(['t']))
        .expect(403);
      await spec.client.get(`${PINS}/x/history`).expect(403);
    });
  });

  describe('as an admin', () => {
    beforeEach(async () => {
      await signInAdmin();
    });

    it('creates a pin with its defaults and records the creation with its admin', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Festive song',
        coverUrl: 'https://cdn.example/festive.webp',
      });

      const response = await spec.client
        .post(PINS)
        .send(rowPinBody([track.id], { position: 2 }))
        .expect(201);

      expect(response.body).toMatchObject({
        kind: 'row',
        layout: 'standard',
        source: { type: 'tracks', trackIds: [track.id] },
        position: 2,
        priority: 0,
        audience: 'everyone',
        locale: null,
        startsAt: null,
        endsAt: null,
        sponsored: false,
        titles: { en: 'Festive', 'pt-BR': 'Festivo' },
        createdBy: { name: 'Ada Admin' },
        updatedBy: { name: 'Ada Admin' },
      });
      const history = await spec.client
        .get(`${PINS}/${response.body.id}/history`)
        .expect(200);
      expect(history.body.items).toEqual([
        expect.objectContaining({
          action: 'CREATED',
          actor: { id: expect.any(String), name: 'Ada Admin' },
        }),
      ]);
    });

    it('refuses a Track whose Processing is not completed, as a validation error', async () => {
      const track = await queuedTrack(spec.testApp.db);

      const response = await spec.client
        .post(PINS)
        .send(rowPinBody([track.id]))
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(response.body.details.issues).toEqual([
        expect.objectContaining({ trackId: track.id }),
      ]);
    });

    it('refuses a hero whose Track has no cover', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'No cover',
      });

      const response = await spec.client
        .post(PINS)
        .send(heroPinBody(track.id))
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('refuses a hero on a row layout, and a row on the hero layout', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Layouts',
        coverUrl: 'https://cdn.example/layouts.webp',
      });

      await spec.client
        .post(PINS)
        .send(rowPinBody([track.id], { kind: 'hero' }))
        .expect(400);
      await spec.client
        .post(PINS)
        .send(rowPinBody([track.id], { layout: 'hero' }))
        .expect(400);
    });

    it('refuses a row without a title for each locale it serves', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Titles',
      });

      await spec.client
        .post(PINS)
        .send(rowPinBody([track.id], { titles: { en: 'Only English' } }))
        .expect(400);
      await spec.client
        .post(PINS)
        .send(
          rowPinBody([track.id], {
            locale: 'pt-BR',
            titles: { en: 'Only English' },
          }),
        )
        .expect(400);
    });

    it('refuses a window that ends before it starts', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Window',
      });

      await spec.client
        .post(PINS)
        .send(
          rowPinBody([track.id], {
            startsAt: '2026-10-10T00:00:00.000Z',
            endsAt: '2026-10-09T00:00:00.000Z',
          }),
        )
        .expect(400);
    });

    it('refuses an update that brings in a Track that cannot appear', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Good',
      });
      const queued = await queuedTrack(spec.testApp.db);
      const pin = await createPin(rowPinBody([track.id]));

      await spec.client
        .patch(`${PINS}/${pin.id}`)
        .send({ source: { type: 'tracks', trackIds: [queued.id] } })
        .expect(400);
    });

    it('updates a pin and records each change with the admin who made it', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Toggle',
      });
      const pin = await createPin(rowPinBody([track.id]));
      const before = revalidatedTags().length;

      const updated = await spec.client
        .patch(`${PINS}/${pin.id}`)
        .send({ sponsored: true })
        .expect(200);

      expect(updated.body).toMatchObject({
        sponsored: true,
        updatedBy: { name: 'Ada Admin' },
      });
      expect(revalidatedTags().slice(before)).toEqual(
        expect.arrayContaining(['home:en', 'home:pt-BR']),
      );
      const history = await spec.client
        .get(`${PINS}/${pin.id}/history`)
        .expect(200);
      expect(history.body.items[0]).toMatchObject({
        action: 'UPDATED',
        changedFields: ['sponsored'],
        state: expect.objectContaining({ sponsored: true }),
      });
    });

    it('schedules the start and the end of a pin that is still ahead', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Scheduled',
      });
      const startsAt = new Date(Date.now() + 3_600_000).toISOString();
      const endsAt = new Date(Date.now() + 7_200_000).toISOString();

      await createPin(rowPinBody([track.id], { startsAt, endsAt }));

      const jobs = spec.testApp.queues[EDITORIAL_PIN_QUEUE]?.added ?? [];
      expect(jobs.map((job) => job.name)).toEqual([
        'invalidate-home-for-pin',
        'invalidate-home-for-pin',
      ]);
    });

    it('removes a pin, answers NOT_FOUND afterwards and keeps its history', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Removed',
      });
      const pin = await createPin(rowPinBody([track.id]));

      await spec.client.delete(`${PINS}/${pin.id}`).expect(204);

      await spec.client.get(`${PINS}/${pin.id}`).expect(404);
      const history = await spec.client
        .get(`${PINS}/${pin.id}/history`)
        .expect(200);
      expect(
        history.body.items.map((item: { action: string }) => item.action),
      ).toEqual(['DELETED', 'CREATED']);
    });

    it('answers NOT_FOUND for an unknown pin', async () => {
      const response = await spec.client.get(`${PINS}/missing`).expect(404);

      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('lists pins newest first, a page at a time', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Listed',
      });
      await createPin(rowPinBody([track.id], { position: 1 }));
      await createPin(rowPinBody([track.id], { position: 2 }));
      await createPin(rowPinBody([track.id], { position: 3 }));

      const first = await spec.client.get(`${PINS}?limit=2`).expect(200);
      const second = await spec.client
        .get(`${PINS}?limit=2&cursor=${first.body.nextCursor}`)
        .expect(200);

      expect(
        first.body.items.map((item: { position: number }) => item.position),
      ).toEqual([3, 2]);
      expect(
        second.body.items.map((item: { position: number }) => item.position),
      ).toEqual([1]);
      expect(second.body.nextCursor).toBeNull();
    });

    it('refuses a cursor it did not issue', async () => {
      const response = await spec.client
        .get(`${PINS}?cursor=not-a-cursor`)
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });
});
