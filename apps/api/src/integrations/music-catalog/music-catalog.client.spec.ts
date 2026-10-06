import { Test, type TestingModule } from '@nestjs/testing';
import { WebSocketServer } from 'ws';
import {
  type FakeMusicCatalog,
  startFakeMusicCatalog,
} from '../../../test/utils/fake-music-catalog.js';
import { ENV } from '../../config/env.js';
import { MusicCatalogClient } from './music-catalog.client.js';

const API_KEY = 'test-music-catalog-api-key-change-me-00';

const testSummary = (mbid: string, title: string) => ({
  mbid,
  title,
  lengthMs: 180_000,
  disambiguation: '',
  video: false,
  artistCredit: { name: 'Test Artist', artists: [] },
  genres: [],
  primaryRelease: {
    mbid: '11111111-1111-1111-8111-111111111111',
    title: 'Test Release',
    year: 2020,
    coverArtUrl: 'https://coverartarchive.org/release/test/front-500',
  },
});

const MBID_1 = '11111111-1111-1111-8111-111111111111';
const MBID_2 = '22222222-2222-2222-8222-222222222222';

const createClient = async (
  url: string | undefined,
  timeoutMs = 1_000,
): Promise<{ client: MusicCatalogClient; moduleRef: TestingModule }> => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      MusicCatalogClient,
      {
        provide: ENV,
        useValue: {
          MUSIC_CATALOG_URL: url,
          MUSIC_CATALOG_API_KEY: API_KEY,
          MUSIC_CATALOG_REQUEST_TIMEOUT_MS: timeoutMs,
        },
      },
    ],
  }).compile();
  await moduleRef.init();
  return { client: moduleRef.get(MusicCatalogClient), moduleRef };
};

describe('MusicCatalogClient', () => {
  let moduleRef: TestingModule | undefined;
  let fake: FakeMusicCatalog | undefined;

  afterEach(async () => {
    // The app closes first so its socket is gone before the fake server
    // stops waiting for connections (`server.close` waits for open peers).
    await moduleRef?.close();
    moduleRef = undefined;
    await fake?.close();
    fake = undefined;
  });

  it('searches with key auth and keeps the catalog order', async () => {
    fake = await startFakeMusicCatalog(() => ({
      result: {
        results: [testSummary(MBID_1, 'First'), testSummary(MBID_2, 'Second')],
      },
    }));
    const created = await createClient(fake.url);
    moduleRef = created.moduleRef;

    const result = await created.client.search({
      query: 'song',
      scope: 'metadata',
      limit: 20,
      offset: 0,
    });

    expect(fake.seenAuth).toEqual([`Bearer ${API_KEY}`]);
    expect(result.results.map((item) => item.title)).toEqual([
      'First',
      'Second',
    ]);
  });

  it('multiplexes concurrent searches with out-of-order responses', async () => {
    fake = await startFakeMusicCatalog((payload) => {
      const query = String(payload.query ?? '');
      // The first request answers last: matching by id still routes each
      // answer to its own caller.
      if (query === 'first') {
        return {
          delayMs: 80,
          result: { results: [testSummary(MBID_1, 'First')] },
        };
      }
      return {
        delayMs: 10,
        result: { results: [testSummary(MBID_2, 'Second')] },
      };
    });
    const created = await createClient(fake.url);
    moduleRef = created.moduleRef;

    const [first, second] = await Promise.all([
      created.client.search({
        query: 'first',
        scope: 'metadata',
        limit: 20,
        offset: 0,
      }),
      created.client.search({
        query: 'second',
        scope: 'metadata',
        limit: 20,
        offset: 0,
      }),
    ]);

    expect(first.results.map((item) => item.title)).toEqual(['First']);
    expect(second.results.map((item) => item.title)).toEqual(['Second']);
  });

  it('times out when the catalog is too slow', async () => {
    fake = await startFakeMusicCatalog(() => ({
      delayMs: 200,
      result: { results: [] },
    }));
    const created = await createClient(fake.url, 20);
    moduleRef = created.moduleRef;

    await expect(
      created.client.search({
        query: 'slow',
        scope: 'metadata',
        limit: 20,
        offset: 0,
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Music catalog request timed out',
    });
  });

  it('turns a catalog error into an AppException', async () => {
    fake = await startFakeMusicCatalog(() => ({
      error: { code: 'CATALOG_NOT_READY', message: 'Not ready yet' },
    }));
    const created = await createClient(fake.url);
    moduleRef = created.moduleRef;

    await expect(
      created.client.search({
        query: 'song',
        scope: 'metadata',
        limit: 20,
        offset: 0,
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Not ready yet',
    });
  });

  it('refuses to search when the catalog is not configured', async () => {
    const created = await createClient(undefined);
    moduleRef = created.moduleRef;

    await expect(
      created.client.search({
        query: 'song',
        scope: 'metadata',
        limit: 20,
        offset: 0,
      }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('drops unreadable frames and still answers the request', async () => {
    const server = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) =>
      server.on('listening', () => resolve()),
    );
    const address = server.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    const url = `ws://127.0.0.1:${port}`;
    server.on('connection', (socket) => {
      socket.on('message', (data) => {
        const message = JSON.parse(String(data)) as { id: string };
        socket.send('not json');
        socket.send(JSON.stringify({ id: 'unknown-id', ok: true, result: {} }));
        socket.send(
          JSON.stringify({
            id: message.id,
            ok: true,
            result: { results: [testSummary(MBID_1, 'Kept')] },
          }),
        );
      });
    });
    fake = {
      url,
      seenAuth: [],
      close: () =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    };
    const created = await createClient(url);
    moduleRef = created.moduleRef;

    const result = await created.client.search({
      query: 'song',
      scope: 'metadata',
      limit: 20,
      offset: 0,
    });

    expect(result.results.map((item) => item.title)).toEqual(['Kept']);
  });

  it('rejects the in-flight search when the connection drops', async () => {
    const server = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) =>
      server.on('listening', () => resolve()),
    );
    const address = server.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    const url = `ws://127.0.0.1:${port}`;
    server.on('connection', (socket) => {
      socket.on('message', () => {
        socket.close();
      });
    });
    fake = {
      url,
      seenAuth: [],
      close: () =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    };
    const created = await createClient(url);
    moduleRef = created.moduleRef;

    await expect(
      created.client.search({
        query: 'song',
        scope: 'metadata',
        limit: 20,
        offset: 0,
      }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('boots without a catalog when the initial dial fails', async () => {
    const created = await createClient('ws://127.0.0.1:1', 50);
    moduleRef = created.moduleRef;

    await expect(
      created.client.search({
        query: 'song',
        scope: 'metadata',
        limit: 20,
        offset: 0,
      }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('refuses to boot in production without a catalog', () => {
    const client = new MusicCatalogClient({
      NODE_ENV: 'production',
      MUSIC_CATALOG_URL: undefined,
      MUSIC_CATALOG_API_KEY: undefined,
      MUSIC_CATALOG_REQUEST_TIMEOUT_MS: 1_000,
    } as never);

    expect(() => client.onModuleInit()).toThrow(
      'MUSIC_CATALOG_URL: Required in production',
    );
  });
});
