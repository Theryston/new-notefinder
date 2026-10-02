import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import { musicCatalogStatusResponseSchema } from '@notefinder/contracts';
import type { Database } from '../src/database/database.js';
import {
  type FakeDumpRecording,
  writeFakeLrclibDump,
} from '../src/integrations/lrclib/fake-lrclib-dump.js';
import {
  LRCLIB_API_USER_AGENT,
  type LrclibApiTrack,
} from '../src/integrations/lrclib/lrclib-api.js';
import { type TestServer, useTestServer } from './utils/create-test-server.js';
import { setBootstrapState } from './utils/database.js';
import {
  type FakeLrclibApiServer,
  startFakeLrclibApiServer,
} from './utils/fake-lrclib-api-server.js';
import {
  type FakeLrclibServer,
  fakeLrclibDumpGz,
  startFakeLrclibServer,
} from './utils/fake-lrclib-server.js';
import { requestRecording } from './utils/get-recording-client.js';
import { setRefreshState } from './utils/lrclib-refresh-state.js';
import { addArtist, addRecording, mbid } from './utils/musicbrainz.js';
import { addRelease, addTrack } from './utils/musicbrainz-relations.js';
import { requestSearch } from './utils/search-client.js';
import {
  createTestWorker,
  useEmptyLyricsIndex,
  useEmptySearchIndex,
} from './utils/test-worker.js';
import { useTestClient } from './utils/use-test-client.js';
import type { TestClient } from './utils/ws-client.js';

const REC_A = mbid(31);
const REC_B = mbid(32);

const DUMP_ONE = 'lrclib-db-dump-20260101T000000Z.sqlite3.gz';
const DUMP_TWO = 'lrclib-db-dump-20260215T000000Z.sqlite3.gz';

// Two Recordings: the first matches its dump row, the second only gets an
// album tie that must never match (the generator's index-1 role), so it
// stays without Lyrics until the API lookup.
const arrangeDuo = async (db: Database): Promise<FakeDumpRecording[]> => {
  const moths = await addArtist(db, { name: 'Copper Moths', mbid: mbid(41) });
  const parade = await addArtist(db, { name: 'Silent Parade', mbid: mbid(42) });
  const songs = [
    {
      mbid: REC_A,
      name: 'Copper Kettle',
      artists: [{ artist: moths }],
      lengthMs: 210_000,
      album: 'Evening Static',
    },
    {
      mbid: REC_B,
      name: 'Glass Parade',
      artists: [{ artist: parade }],
      lengthMs: 195_000,
      album: 'Tide Charts',
    },
  ] as const;
  const recordings: FakeDumpRecording[] = [];
  for (const song of songs) {
    const recorded = await addRecording(db, {
      mbid: song.mbid,
      name: song.name,
      artists: song.artists,
      lengthMs: song.lengthMs,
    });
    const release = await addRelease(db, {
      name: song.album,
      artistCredit: recorded.artistCredit,
    });
    await addTrack(db, { release, recording: recorded });
    recordings.push({
      mbid: song.mbid,
      title: song.name,
      artist: song.artists[0]?.artist.name ?? '',
      lengthMs: song.lengthMs,
      albums: [song.album],
    });
  }
  return recordings;
};

// The same dump with every Lyrics text rewritten, the way a newer dump
// carries corrected words for the same tracks.
const refreshedDumpGz = (
  recordings: readonly FakeDumpRecording[],
  marker: string,
): Buffer => {
  const dir = mkdtempSync(join(tmpdir(), 'lrclib-refresh-e2e-'));
  try {
    const path = join(dir, 'lrclib.sqlite3');
    writeFakeLrclibDump(path, recordings);
    const db = new DatabaseSync(path);
    try {
      const tracks = db.prepare('SELECT id FROM tracks').all() as {
        id: number;
      }[];
      const update = db.prepare(
        'UPDATE lyrics SET plain_lyrics = ?, synced_lyrics = ? WHERE track_id = ?',
      );
      for (const track of tracks) {
        update.run(
          `Refreshed words ${marker} still drifting on`,
          `[00:01.00] Refreshed words ${marker} still drifting on`,
          track.id,
        );
      }
    } finally {
      db.close();
    }
    return gzipSync(readFileSync(path));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const lyricsOf = async (
  client: TestClient,
  song: string,
): Promise<{ plain: string | null; synced: string | null }> => {
  const response = await requestRecording(client, { mbid: song });
  if (!response.ok) {
    throw new Error(`getRecording failed: ${response.error.code}`);
  }
  return response.result.lyrics;
};

const searchMbids = async (
  client: TestClient,
  query: string,
  scope: 'metadata' | 'lyrics',
): Promise<string[]> => {
  const response = await requestSearch(client, { query, scope });
  if (!response.ok) {
    throw new Error(`search failed: ${response.error.code}`);
  }
  return response.result.results.map((result) => result.mbid);
};

const statusPhase = async (client: TestClient): Promise<string> => {
  const response = musicCatalogStatusResponseSchema.parse(
    await client.request('status', {}),
  );
  if (!response.ok) {
    throw new Error(`status failed: ${response.error.code}`);
  }
  return response.result.phase;
};

type Servers = {
  lrclib: FakeLrclibServer;
  api: FakeLrclibApiServer;
  close: () => Promise<void>;
};

const startServers = async (options: {
  dumps: Record<string, Buffer>;
  apiTracks?: readonly LrclibApiTrack[];
  apiFailures?: string[];
}): Promise<Servers> => {
  const lrclib = await startFakeLrclibServer(options.dumps);
  const api = await startFakeLrclibApiServer({
    tracks: options.apiTracks ?? [],
    failures: options.apiFailures ?? [],
  });
  return {
    lrclib,
    api,
    close: async () => {
      await api.close();
      await lrclib.close();
    },
  };
};

// One worker tick in `full` mode, the way `worker.ts` ticks: the listing and
// the API point at the fake servers, and the intervals stay tiny so the
// refresh is due whenever the test ages its state.
const tickWorker = async (
  server: TestServer,
  servers: Servers,
  env: Record<string, string> = {},
): Promise<void> => {
  const worker = createTestWorker(server, {
    env: {
      CATALOG_DATASET: 'full',
      LRCLIB_BASE_URL: servers.lrclib.baseUrl,
      LRCLIB_LISTING_URL: servers.lrclib.listingUrl,
      LRCLIB_API_BASE_URL: servers.api.baseUrl,
      LRCLIB_REFRESH_CHECK_INTERVAL_MS: '1',
      LRCLIB_REFRESH_MIN_INTERVAL_DAYS: '1',
      ...env,
    },
  });
  await worker.tick();
};

// The first tick, from where the mbslave container leaves the catalog
// (`restored`): later ticks leave the phase alone, the way the worker finds
// it (`ready` after the first one reaches it).
const tickFirst = async (
  server: TestServer,
  servers: Servers,
  env: Record<string, string> = {},
): Promise<void> => {
  await setBootstrapState(server.db, { phase: 'restored', dataset: 'full' });
  await tickWorker(server, servers, env);
};

const ageRefreshState = async (db: Database, key: string): Promise<void> => {
  const aged = new Date(Date.now() - 2 * 86_400_000);
  await setRefreshState(db, {
    lastDumpKey: key,
    lastCheckedAt: aged,
    lastImportedAt: aged,
  });
};

describe('lyrics refresh: newer dumps and the outbox API lookup (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  useEmptySearchIndex();
  useEmptyLyricsIndex();

  it('imports a newer dump and serves the new Lyrics', async () => {
    const recordings = await arrangeDuo(server().db);
    const first = await startServers({
      dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
    });
    try {
      await tickFirst(server(), first);
      await expect(lyricsOf(client(), REC_A)).resolves.toMatchObject({
        plain: expect.stringContaining('fake-lrclib-0'),
      });
      await expect(lyricsOf(client(), REC_B)).resolves.toEqual({
        plain: null,
        synced: null,
      });

      const second = await startServers({
        dumps: {
          [DUMP_ONE]: fakeLrclibDumpGz(recordings),
          [DUMP_TWO]: refreshedDumpGz(recordings, 'second-pressing'),
        },
      });
      try {
        await ageRefreshState(server().db, DUMP_ONE);
        await tickWorker(server(), second);

        await expect(lyricsOf(client(), REC_A)).resolves.toMatchObject({
          plain: expect.stringContaining('second-pressing'),
          synced: expect.stringContaining('[00:01.00]'),
        });
        const found = await searchMbids(
          client(),
          'second-pressing still drifting',
          'lyrics',
        );
        expect(found[0]).toBe(REC_A);
        // The replaced document is gone: the old words find nothing.
        await expect(
          searchMbids(client(), 'fake-lrclib-0 drifting', 'lyrics'),
        ).resolves.not.toContain(REC_A);
        // The refresh never takes the catalog offline.
        await expect(statusPhase(client())).resolves.toBe('ready');
      } finally {
        await second.close();
      }
    } finally {
      await first.close();
    }
  });

  it('skips a dump it already imported', async () => {
    const recordings = await arrangeDuo(server().db);
    const servers = await startServers({
      dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
    });
    try {
      await tickFirst(server(), servers);
      await ageRefreshState(server().db, DUMP_ONE);
      await tickWorker(server(), servers);

      const downloads = servers.lrclib.requested.filter((path) =>
        path.startsWith('/files/'),
      );
      expect(downloads).toEqual([`/files/${DUMP_ONE}`]);
      await expect(lyricsOf(client(), REC_A)).resolves.toMatchObject({
        plain: expect.stringContaining('fake-lrclib-0'),
      });
    } finally {
      await servers.close();
    }
  });

  it('waits out the minimum interval even for a newer dump', async () => {
    const recordings = await arrangeDuo(server().db);
    const servers = await startServers({
      dumps: {
        [DUMP_ONE]: fakeLrclibDumpGz(recordings),
        [DUMP_TWO]: refreshedDumpGz(recordings, 'second-pressing'),
      },
    });
    try {
      // The listing only keeps the latest dump, so the first tick imports
      // the newer one straight away.
      await tickFirst(server(), servers);
      await expect(lyricsOf(client(), REC_A)).resolves.toMatchObject({
        plain: expect.stringContaining('second-pressing'),
      });

      // A third dump appears days later in listing time, but the minimum
      // interval (the default 30 days) has not passed since the import.
      const third = await startServers({
        dumps: {
          [DUMP_TWO]: refreshedDumpGz(recordings, 'second-pressing'),
          'lrclib-db-dump-20260301T000000Z.sqlite3.gz': refreshedDumpGz(
            recordings,
            'third-pressing',
          ),
        },
      });
      try {
        await tickWorker(server(), third, {
          LRCLIB_REFRESH_MIN_INTERVAL_DAYS: '30',
        });
        expect(
          third.lrclib.requested.filter((path) => path.startsWith('/files/')),
        ).toHaveLength(0);
        await expect(lyricsOf(client(), REC_A)).resolves.toMatchObject({
          plain: expect.stringContaining('second-pressing'),
        });
      } finally {
        await third.close();
      }
    } finally {
      await servers.close();
    }
  });

  it('fills an outbox Recording from the API, politely', async () => {
    const recordings = await arrangeDuo(server().db);
    const servers = await startServers({
      dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
    });
    try {
      await tickFirst(server(), servers);
      await expect(lyricsOf(client(), REC_B)).resolves.toEqual({
        plain: null,
        synced: null,
      });

      const glass = recordings[1];
      const withApi = await startServers({
        dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
        apiTracks: glass
          ? [
              {
                trackName: glass.title,
                artistName: glass.artist,
                albumName: glass.albums[0] ?? '',
                duration: (glass.lengthMs ?? 0) / 1000,
                plainLyrics: 'Harbor words only the API knows',
                syncedLyrics: '[00:01.00] Harbor words only the API knows',
              },
            ]
          : [],
      });
      try {
        await tickWorker(server(), withApi);

        await expect(lyricsOf(client(), REC_B)).resolves.toMatchObject({
          plain: expect.stringContaining('Harbor words'),
        });
        const found = await searchMbids(
          client(),
          'Harbor words only the API knows',
          'lyrics',
        );
        expect(found).toContain(REC_B);
        expect(withApi.api.userAgents.length).toBeGreaterThan(0);
        for (const userAgent of withApi.api.userAgents) {
          expect(userAgent).toBe(LRCLIB_API_USER_AGENT);
        }
      } finally {
        await withApi.close();
      }
    } finally {
      await servers.close();
    }
  });

  it('leaves the Recording lyric-less on API failure, still draining', async () => {
    const recordings = await arrangeDuo(server().db);
    const servers = await startServers({
      dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
      apiFailures: [recordings[1]?.title ?? ''],
    });
    try {
      await tickFirst(server(), servers);
      await tickWorker(server(), servers);

      await expect(lyricsOf(client(), REC_B)).resolves.toEqual({
        plain: null,
        synced: null,
      });
      // The outbox still drained: the metadata index answers.
      const found = await searchMbids(client(), 'Glass Parade', 'metadata');
      expect(found).toContain(REC_B);
      await expect(statusPhase(client())).resolves.toBe('ready');
    } finally {
      await servers.close();
    }
  });

  it('keeps serving the kept Lyrics when the listing fails', async () => {
    const recordings = await arrangeDuo(server().db);
    const servers = await startServers({
      dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
    });
    try {
      await tickFirst(server(), servers);
      await ageRefreshState(server().db, DUMP_ONE);
      await tickWorker(server(), servers, {
        LRCLIB_LISTING_URL: 'http://127.0.0.1:1/listing',
      });

      await expect(statusPhase(client())).resolves.toBe('ready');
      await expect(lyricsOf(client(), REC_A)).resolves.toMatchObject({
        plain: expect.stringContaining('fake-lrclib-0'),
      });
    } finally {
      await servers.close();
    }
  });
});
