import { count } from 'drizzle-orm';
import request from 'supertest';
import { editorialPins } from '../src/database/schema/editorial-pins.js';
import { events } from '../src/database/schema/events.js';
import { type AuthClient, createAuthClient, signIn } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  rowPinBody,
  signInPinsAdmin,
} from './utils/editorial-pin-factories.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';
import {
  sharedInMemoryCache,
  withInMemoryCache,
} from './utils/in-memory-cache.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

const PIN_PATH = '/v1/admin/home-pins';
const PREVIEW_PATH = `${PIN_PATH}/preview`;
const METRICS_PATH = `${PIN_PATH}/metrics`;

describe('Admin home pin preview and metrics (e2e)', () => {
  let testApp: TestApp;
  let admin: AuthClient;
  let trackIds: string[];

  beforeAll(async () => {
    testApp = await createTestApp({ override: withInMemoryCache });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
    sharedInMemoryCache.clear();
    admin = createAuthClient(testApp);
    trackIds = [];
    for (let index = 0; index < 14; index += 1) {
      const track = await createCompletedTrack(testApp.db, {
        title: `Preview Track ${index}`,
        coverUrl: `https://cdn.example/preview-${index}.webp`,
        trendingScore: 100 - index,
        artistCredit: [{ name: `Preview Artist ${index}`, joinPhrase: '' }],
      });
      trackIds.push(track.id);
    }
    await signInPinsAdmin(testApp.db, admin);
  });

  it('keeps preview admin-only and does not persist a scheduled signed-in draft', async () => {
    const anonymous = request(testApp.app.getHttpServer());
    await anonymous.post(PREVIEW_PATH).send({}).expect(401);

    const user = await createUser(testApp.db, { username: 'preview-user' });
    await createCredentialAccount(testApp.db, user);
    const regular = createAuthClient(testApp);
    await signIn(regular, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    await regular.post(PREVIEW_PATH).send({}).expect(403);

    const draft = rowPinBody(trackIds.slice(7, 13), {
      startsAt: new Date(Date.now() + 60_000).toISOString(),
      audience: 'visitors',
      sponsored: true,
    });
    const before = await admin.get('/v1/home').expect(200);
    const preview = await admin
      .post(PREVIEW_PATH)
      .send({ pin: draft, locale: 'en', audience: 'signed-in' })
      .expect(200);

    expect(preview.headers['cache-control']).toBe('private, no-store');
    expect(preview.body.audience).toBe('personal');
    expect(preview.body.rows).toContainEqual(
      expect.objectContaining({
        id: 'pin-preview',
        sponsored: true,
        title: { key: 'home.rows.pinned', params: { title: 'Festive' } },
      }),
    );
    expect(
      await testApp.db.select({ count: count() }).from(editorialPins),
    ).toEqual([{ count: 0 }]);
    const after = await admin.get('/v1/home').expect(200);
    expect(after.body.rows).toEqual(before.body.rows);
  });

  it('replaces an existing pin in an edit preview and uses the chosen locale', async () => {
    const existing = await admin
      .post(PIN_PATH)
      .send(rowPinBody(trackIds.slice(0, 6)))
      .expect(201);
    const pinId = existing.body.id as string;
    const replacement = rowPinBody(trackIds.slice(7, 13), {
      titles: { en: 'New draft title', 'pt-BR': 'Novo título' },
      startsAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const preview = await admin
      .post(PREVIEW_PATH)
      .send({
        pin: replacement,
        pinId,
        locale: 'pt-BR',
        audience: 'visitor',
      })
      .expect(200);
    const pinnedRow = preview.body.rows.find(
      (row: { id: string }) => row.id === `pin-${pinId}`,
    );
    expect(pinnedRow.title.params.title).toBe('Novo título');
    expect(pinnedRow.items.map((item: { id: string }) => item.id)).toEqual(
      trackIds.slice(7, 13),
    );
  });

  it('counts persisted impressions and clicks only in each pin window', async () => {
    const start = new Date(Date.now() - 60_000);
    const end = new Date(Date.now() + 60_000);
    const created = await admin
      .post(PIN_PATH)
      .send(
        rowPinBody(trackIds.slice(7, 13), {
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
        }),
      )
      .expect(201);
    const pinId = created.body.id as string;
    const rowId = `pin-${pinId}`;
    const emptyPin = await admin
      .post(PIN_PATH)
      .send(rowPinBody(trackIds.slice(0, 6)))
      .expect(201);
    const outside = new Date(Date.now() - 120_000);
    await testApp.db.insert(events).values([
      {
        visitorId: 'visitor-preview',
        userId: null,
        type: 'home.row_impression',
        rowId,
        feedVersion: 'preview-version',
        algorithmVersion: 1,
        itemId: null,
        position: null,
        payload: { type: 'home.row_impression', rowId },
        createdAt: new Date(),
      },
      {
        visitorId: 'visitor-preview',
        userId: null,
        type: 'home.row_impression',
        rowId,
        feedVersion: 'preview-version',
        algorithmVersion: 1,
        itemId: null,
        position: null,
        payload: { type: 'home.row_impression', rowId },
        createdAt: outside,
      },
      {
        visitorId: 'visitor-preview',
        userId: null,
        type: 'home.item_click',
        rowId,
        feedVersion: 'preview-version',
        algorithmVersion: 1,
        itemId: trackIds[7] ?? '',
        position: 0,
        payload: { type: 'home.item_click', rowId },
        createdAt: new Date(),
      },
    ]);

    const response = await admin.get(METRICS_PATH).expect(200);
    expect(response.body).toContainEqual({
      pinId,
      impressions: 1,
      clicks: 1,
      clickThroughRate: 1,
    });
    expect(response.body).toContainEqual({
      pinId: emptyPin.body.id,
      impressions: 0,
      clicks: 0,
      clickThroughRate: 0,
    });
    expect(
      await testApp.db.select({ id: editorialPins.id }).from(editorialPins),
    ).toHaveLength(2);
  });
});
