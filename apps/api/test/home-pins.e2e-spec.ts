import { eq } from 'drizzle-orm';
import request from 'supertest';
import { trackProcessings } from '../src/database/schema/track-processings.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import { rowPinBody } from './utils/editorial-pin-factories.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

const PINS = '/v1/admin/home-pins';
const HOUR_MS = 3_600_000;

/**
 * Twenty completed Tracks with covers, hottest first, each by its own artist
 * (so the artist cap never trims a row). The first is the hero, the next
 * twelve the trending row, and the rest the new Tracks row.
 */
const seedTracks = async (db: Parameters<typeof createCompletedTrack>[0]) => {
  const ids: string[] = [];
  for (let i = 0; i < 20; i += 1) {
    const track = await createCompletedTrack(db, {
      title: `Track ${i}`,
      coverUrl: `https://cdn.example/track-${i}.webp`,
      trendingScore: 100 - i,
      artistCredit: [{ name: `Artist ${i}`, joinPhrase: '' }],
    });
    ids.push(track.id);
  }
  return ids;
};

type Row = {
  id: string;
  layout: string;
  sponsored?: boolean;
  title?: { key: string; params: Record<string, string | number> };
  track?: { id: string };
  items?: { id: string }[];
};

describe('Home feed with editorial pins (e2e)', () => {
  const spec = useAuthSpec();
  let ids: string[] = [];

  /** The public feed as a visitor who is not signed in gets it. */
  const visitorRows = async (locale = 'en'): Promise<Row[]> => {
    const response = await request(spec.testApp.app.getHttpServer())
      .get(`/v1/home?locale=${locale}`)
      .expect(200);
    return response.body.rows as Row[];
  };

  /** The same feed as the signed-in admin (a signed-in User) gets it. */
  const signedInRows = async (): Promise<Row[]> => {
    const response = await spec.client.get('/v1/home').expect(200);
    return response.body.rows as Row[];
  };

  const createPin = async (body: Record<string, unknown>): Promise<string> => {
    const response = await spec.client.post(PINS).send(body).expect(201);
    return response.body.id as string;
  };

  const itemIds = (row: Row | undefined): string[] =>
    (row?.items ?? []).map((item) => item.id);

  beforeEach(async () => {
    ids = await seedTracks(spec.testApp.db);
    const admin = await createUser(spec.testApp.db, {
      role: 'ADMIN',
      name: 'Ada Admin',
      username: 'pins-admin',
      email: 'pins-admin@example.com',
    });
    await createCredentialAccount(spec.testApp.db, admin);
    await signIn(spec.client, {
      email: admin.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  });

  it('shows the algorithmic feed when no pin is live', async () => {
    const rows = await visitorRows();

    expect(rows.map((row) => row.layout)).toEqual([
      'hero',
      'standard',
      'standard',
    ]);
    expect(rows[0]?.track?.id).toBe(ids[0]);
  });

  it('places a pinned row at its position, in the admin order, without the sponsored flag', async () => {
    const pinId = await createPin(
      rowPinBody([ids[15] ?? '', ids[16] ?? '', ids[17] ?? ''], {
        position: 1,
      }),
    );

    const rows = await visitorRows();

    expect(rows[1]).toMatchObject({
      id: `pin-${pinId}`,
      layout: 'standard',
      title: { key: 'home.rows.pinned', params: { title: 'Festive' } },
    });
    expect(itemIds(rows[1])).toEqual([ids[15], ids[16], ids[17]]);
    expect(rows[1]).not.toHaveProperty('sponsored');
  });

  it('keeps a pinned Track out of the algorithmic rows', async () => {
    await createPin(rowPinBody([ids[3] ?? '', ids[4] ?? '']));

    const rows = await visitorRows();
    const trending = rows.find((row) => row.id === 'trending-today');

    expect(itemIds(trending)).not.toContain(ids[3]);
    expect(itemIds(trending)).not.toContain(ids[4]);
  });

  it('marks a sponsored pin for visitors and signed-in Users alike', async () => {
    const pinId = await createPin(
      rowPinBody([ids[15] ?? ''], { sponsored: true }),
    );

    const visitor = (await visitorRows()).find(
      (row) => row.id === `pin-${pinId}`,
    );
    const signedIn = (await signedInRows()).find(
      (row) => row.id === `pin-${pinId}`,
    );

    expect(visitor).toMatchObject({ sponsored: true });
    expect(signedIn).toMatchObject({ sponsored: true });
  });

  it('shows a visitors-only pin to visitors and not to signed-in Users', async () => {
    const pinId = await createPin(
      rowPinBody([ids[15] ?? ''], { audience: 'visitors' }),
    );

    expect((await visitorRows()).map((row) => row.id)).toContain(
      `pin-${pinId}`,
    );
    expect((await signedInRows()).map((row) => row.id)).not.toContain(
      `pin-${pinId}`,
    );
  });

  it('shows a locale-limited pin only in its locale', async () => {
    const pinId = await createPin(
      rowPinBody([ids[15] ?? ''], { locale: 'pt-BR' }),
    );

    expect((await visitorRows('en')).map((row) => row.id)).not.toContain(
      `pin-${pinId}`,
    );
    const portuguese = (await visitorRows('pt-BR')).find(
      (row) => row.id === `pin-${pinId}`,
    );
    expect(portuguese?.title).toEqual({
      key: 'home.rows.pinned',
      params: { title: 'Festivo' },
    });
  });

  it('shows a time-boxed pin only inside its window', async () => {
    const now = Date.now();
    const iso = (offset: number) => new Date(now + offset).toISOString();
    const upcoming = await createPin(
      rowPinBody([ids[12] ?? ''], {
        startsAt: iso(HOUR_MS),
        endsAt: iso(2 * HOUR_MS),
      }),
    );
    const live = await createPin(
      rowPinBody([ids[13] ?? ''], {
        startsAt: iso(-HOUR_MS),
        endsAt: iso(HOUR_MS),
        priority: 3,
      }),
    );
    const ended = await createPin(
      rowPinBody([ids[14] ?? ''], {
        startsAt: iso(-2 * HOUR_MS),
        endsAt: iso(-HOUR_MS),
        priority: 4,
      }),
    );

    const shown = (await visitorRows()).map((row) => row.id);

    expect(shown).toContain(`pin-${live}`);
    expect(shown).not.toContain(`pin-${upcoming}`);
    expect(shown).not.toContain(`pin-${ended}`);
  });

  it('gives the position to the higher priority pin and moves the other one down', async () => {
    const low = await createPin(rowPinBody([ids[15] ?? ''], { priority: 0 }));
    const high = await createPin(rowPinBody([ids[16] ?? ''], { priority: 5 }));

    const rows = await visitorRows();

    expect(rows[1]?.id).toBe(`pin-${high}`);
    expect(rows[2]?.id).toBe(`pin-${low}`);
  });

  it('shows a pinned hero in the hero slot, sponsored when its pin is', async () => {
    const pinId = await createPin(
      rowPinBody([ids[5] ?? ''], {
        kind: 'hero',
        layout: 'hero',
        sponsored: true,
      }),
    );

    const rows = await visitorRows();

    expect(rows[0]).toMatchObject({
      id: `pin-${pinId}`,
      layout: 'hero',
      sponsored: true,
      track: { id: ids[5] },
    });
  });

  it('skips a pinned Track that is no longer completed, at read time', async () => {
    const pinId = await createPin(rowPinBody([ids[16] ?? '', ids[17] ?? '']));
    const db = spec.testApp.db;
    await db
      .update(trackProcessings)
      .set({ status: 'QUEUED' })
      .where(eq(trackProcessings.trackId, ids[16] ?? ''));

    const rows = await visitorRows();

    expect(rows.find((row) => row.id === `pin-${pinId}`)?.items).toEqual([
      expect.objectContaining({ id: ids[17] }),
    ]);
  });

  it('brings the algorithm back once the pin is removed', async () => {
    const pinId = await createPin(rowPinBody([ids[3] ?? '']));

    await spec.client.delete(`${PINS}/${pinId}`).expect(204);
    const rows = await visitorRows();

    expect(rows.map((row) => row.id)).not.toContain(`pin-${pinId}`);
    expect(rows[1]?.id).toBe('trending-today');
    expect(itemIds(rows[1])).toContain(ids[3]);
  });
});
