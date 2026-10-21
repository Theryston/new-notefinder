import request from 'supertest';
import { WEB_REVALIDATION_QUEUE } from '../src/integrations/web-revalidation/web-revalidation.job.js';
import { EDITORIAL_PIN_QUEUE } from '../src/modules/editorial-pins/editorial-pins.job.js';
import { EditorialPinsRepository } from '../src/modules/editorial-pins/editorial-pins.repository.js';
import type { FakeQueue } from './redis-test-overrides.js';
import {
  createAlbumDisc,
  placeAlbumTrack,
} from './utils/album-track-factories.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  albumPinBody,
  artistPinBody,
  genrePinBody,
  heroPinBody,
  rowPinBody,
  signInPinsAdmin,
} from './utils/editorial-pin-factories.js';
import {
  createAlbum,
  createArtist,
  createCredentialAccount,
  createTrack,
  createUser,
  DEFAULT_PASSWORD,
  linkTrackArtist,
} from './utils/factories.js';
import {
  createCompletedTrack,
  createTrackProcessing,
} from './utils/track-processing-factories.js';

const PINS = '/v1/admin/home-pins';

/** The delay (in ms) of the scheduled job at `index` of a fake queue. */
const delayOf = (queue: FakeQueue | undefined, index: number): number =>
  (queue?.options[index] as { delay?: number } | undefined)?.delay ??
  Number.NaN;

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
      await spec.client.get(`${PINS}/x`).expect(403);
      await spec.client.patch(`${PINS}/x`).send({ priority: 1 }).expect(403);
      await spec.client.delete(`${PINS}/x`).expect(403);
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

      const queue = spec.testApp.queues[EDITORIAL_PIN_QUEUE];
      const jobs = queue?.added ?? [];
      expect(jobs.map((job) => job.name)).toEqual([
        'invalidate-home-for-pin',
        'invalidate-home-for-pin',
      ]);
      // Each job is keyed by its edge and time, and fires after the time left
      // when the pin was saved (a few seconds before the check reads it).
      expect(queue?.options).toEqual([
        expect.objectContaining({
          jobId: expect.stringContaining(`-start-${Date.parse(startsAt)}`),
        }),
        expect.objectContaining({
          jobId: expect.stringContaining(`-end-${Date.parse(endsAt)}`),
        }),
      ]);
      expect(delayOf(queue, 0)).toBeGreaterThan(3_600_000 - 10_000);
      expect(delayOf(queue, 0)).toBeLessThanOrEqual(3_600_000);
      expect(delayOf(queue, 1)).toBeGreaterThan(7_200_000 - 10_000);
      expect(delayOf(queue, 1)).toBeLessThanOrEqual(7_200_000);
    });

    it('shows a pin from its start (inclusive) until its end (exclusive)', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Boundaries',
      });
      const startsAt = new Date(Date.now() + 3_600_000);
      const endsAt = new Date(startsAt.getTime() + 3_600_000);
      const pin = await createPin(
        rowPinBody([track.id], {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      );
      const repository = spec.testApp.app.get(EditorialPinsRepository);
      const liveAt = async (now: Date) =>
        (await repository.findLive({ locale: 'en', signedIn: false, now })).map(
          (live) => live.id,
        );

      expect(await liveAt(new Date(startsAt.getTime() - 1))).not.toContain(
        pin.id,
      );
      expect(await liveAt(startsAt)).toContain(pin.id);
      expect(await liveAt(new Date(endsAt.getTime() - 1))).toContain(pin.id);
      expect(await liveAt(endsAt)).not.toContain(pin.id);
    });

    it('refuses an update that leaves the window ending before it starts', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Merged window',
      });
      const pin = await createPin(rowPinBody([track.id]));

      const response = await spec.client
        .patch(`${PINS}/${pin.id}`)
        .send({
          startsAt: '2026-10-10T00:00:00.000Z',
          endsAt: '2026-10-09T00:00:00.000Z',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { location: 'body' },
      });
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

    it('answers NOT_FOUND for the history of an unknown pin', async () => {
      const response = await spec.client
        .get(`${PINS}/missing/history`)
        .expect(404);

      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('refuses a hero pin that is not at the hero slot', async () => {
      const track = await createCompletedTrack(spec.testApp.db, {
        title: 'Hero slot',
        coverUrl: 'https://cdn.example/hero-slot.webp',
      });

      const response = await spec.client
        .post(PINS)
        .send(heroPinBody(track.id, { position: 3 }))
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
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

    describe('dynamic sources', () => {
      it('creates a genre pin when the genre has enough completed Tracks', async () => {
        for (let i = 0; i < 6; i += 1) {
          await createCompletedTrack(spec.testApp.db, {
            title: `Rock ${i}`,
            genres: ['rock'],
          });
        }

        const response = await spec.client
          .post(PINS)
          .send(genrePinBody('rock'))
          .expect(201);

        expect(response.body).toMatchObject({
          source: { type: 'genre', genre: 'rock' },
        });
      });

      it('refuses a genre with fewer completed Tracks than a row needs', async () => {
        await createCompletedTrack(spec.testApp.db, {
          title: 'Only jazz',
          genres: ['jazz'],
        });

        const response = await spec.client
          .post(PINS)
          .send(genrePinBody('jazz'))
          .expect(400);

        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
        expect(response.body.details.issues).toEqual([
          expect.objectContaining({ path: ['source'] }),
        ]);
      });

      it('creates an artist pin when the Artist has enough completed Tracks', async () => {
        const artist = await createArtist(spec.testApp.db, {
          name: 'Featured',
        });
        for (let i = 0; i < 6; i += 1) {
          const track = await createCompletedTrack(spec.testApp.db, {
            title: `Hit ${i}`,
          });
          await linkTrackArtist(spec.testApp.db, track.id, artist.id);
        }

        const response = await spec.client
          .post(PINS)
          .send(artistPinBody(artist.id))
          .expect(201);

        expect(response.body).toMatchObject({
          source: { type: 'artist', artistId: artist.id },
        });
      });

      it('refuses an artist that does not exist', async () => {
        const response = await spec.client
          .post(PINS)
          .send(artistPinBody('missing-artist'))
          .expect(400);

        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      });

      it('refuses an artist with fewer completed Tracks than a row needs', async () => {
        const artist = await createArtist(spec.testApp.db, {
          name: 'Newcomer',
        });
        const track = await createCompletedTrack(spec.testApp.db, {
          title: 'Debut',
        });
        await linkTrackArtist(spec.testApp.db, track.id, artist.id);

        const response = await spec.client
          .post(PINS)
          .send(artistPinBody(artist.id))
          .expect(400);

        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      });

      it('creates an album pin that keeps no Track list of its own', async () => {
        const album = await createAlbum(spec.testApp.db, {
          title: 'Featured album',
        });
        await createAlbumDisc(spec.testApp.db, album.id, 1);
        for (let i = 0; i < 6; i += 1) {
          const track = await createCompletedTrack(spec.testApp.db, {
            title: `Album track ${i}`,
          });
          await placeAlbumTrack(spec.testApp.db, {
            albumId: album.id,
            trackId: track.id,
            discPosition: 1,
            trackPosition: i + 1,
          });
        }

        const response = await spec.client
          .post(PINS)
          .send(albumPinBody(album.id))
          .expect(201);

        expect(response.body).toMatchObject({
          source: { type: 'album', albumId: album.id },
        });
      });

      it('refuses an album that does not exist', async () => {
        const response = await spec.client
          .post(PINS)
          .send(albumPinBody('missing-album'))
          .expect(400);

        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      });

      it('refuses a hero whose genre offers no Track with a cover', async () => {
        for (let i = 0; i < 6; i += 1) {
          await createCompletedTrack(spec.testApp.db, {
            title: `Coverless ${i}`,
            genres: ['ambient'],
            coverUrl: null,
          });
        }

        const response = await spec.client
          .post(PINS)
          .send(
            genrePinBody('ambient', {
              kind: 'hero',
              layout: 'hero',
              position: 0,
            }),
          )
          .expect(400);

        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      });
    });
  });
});
