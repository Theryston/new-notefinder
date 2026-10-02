import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import { musicCatalogStatusResponseSchema } from '@notefinder/contracts';
import type { Database } from '../../src/database/database.js';
import {
  type FakeDumpRecording,
  writeFakeLrclibDump,
} from '../../src/integrations/lrclib/fake-lrclib-dump.js';
import type { LrclibApiTrack } from '../../src/integrations/lrclib/lrclib-api.js';
import type { TestServer } from './create-test-server.js';
import { setBootstrapState } from './database.js';
import {
  type FakeLrclibApiServer,
  startFakeLrclibApiServer,
} from './fake-lrclib-api-server.js';
import {
  type FakeLrclibServer,
  startFakeLrclibServer,
} from './fake-lrclib-server.js';
import { requestRecording } from './get-recording-client.js';
import { setRefreshState } from './lrclib-refresh-state.js';
import { addArtist, addRecording, mbid } from './musicbrainz.js';
import { addRelease, addTrack } from './musicbrainz-relations.js';
import { requestSearch } from './search-client.js';
import { createTestWorker } from './test-worker.js';
import type { TestClient } from './ws-client.js';

export const REC_A = mbid(31);
export const REC_B = mbid(32);

export const DUMP_ONE = 'lrclib-db-dump-20260101T000000Z.sqlite3.gz';
export const DUMP_TWO = 'lrclib-db-dump-20260215T000000Z.sqlite3.gz';
export const DUMP_THREE = 'lrclib-db-dump-20260301T000000Z.sqlite3.gz';

// Two Recordings: the first matches its dump row, the second only gets an
// album tie that must never match (the generator's index-1 role), so it
// stays without Lyrics until the API lookup.
export const arrangeDuo = async (
  db: Database,
): Promise<FakeDumpRecording[]> => {
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

// A Recording added after the catalog is already ready, the way a
// replication packet would add one: its trigger-written outbox entry is what
// the next tick drains and looks up.
export const addLateSong = async (
  db: Database,
  song: {
    mbid: string;
    title: string;
    artist: string;
    album: string;
    lengthMs: number;
  },
): Promise<FakeDumpRecording> => {
  const artist = await addArtist(db, { name: song.artist });
  const recorded = await addRecording(db, {
    mbid: song.mbid,
    name: song.title,
    artists: [{ artist }],
    lengthMs: song.lengthMs,
  });
  const release = await addRelease(db, {
    name: song.album,
    artistCredit: recorded.artistCredit,
  });
  await addTrack(db, { release, recording: recorded });
  return {
    mbid: song.mbid,
    title: song.title,
    artist: song.artist,
    lengthMs: song.lengthMs,
    albums: [song.album],
  };
};

// The same dump with every Lyrics text rewritten, the way a newer dump
// carries corrected words for the same tracks.
export const refreshedDumpGz = (
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

export const lyricsOf = async (
  client: TestClient,
  song: string,
): Promise<{ plain: string | null; synced: string | null }> => {
  const response = await requestRecording(client, { mbid: song });
  if (!response.ok) {
    throw new Error(`getRecording failed: ${response.error.code}`);
  }
  return response.result.lyrics;
};

export const searchMbids = async (
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

export const statusPhase = async (client: TestClient): Promise<string> => {
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

export const startServers = async (options: {
  dumps: Record<string, Buffer>;
  apiTracks?: readonly LrclibApiTrack[];
  apiFailures?: string[];
  apiVerbatimTitles?: readonly string[];
  apiBeforeResponse?: (title: string) => Promise<void>;
}): Promise<Servers> => {
  const lrclib = await startFakeLrclibServer(options.dumps);
  const api = await startFakeLrclibApiServer({
    tracks: options.apiTracks ?? [],
    failures: options.apiFailures ?? [],
    verbatimTitles: options.apiVerbatimTitles ?? [],
    beforeResponse: options.apiBeforeResponse,
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
export const tickWorker = async (
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
export const tickFirst = async (
  server: TestServer,
  servers: Servers,
  env: Record<string, string> = {},
): Promise<void> => {
  await setBootstrapState(server.db, { phase: 'restored', dataset: 'full' });
  await tickWorker(server, servers, env);
};

// Waits until the lookup reached the fake API: with the candidates peeked
// before the drain and filled after it, the first request proves the drain
// already ran.
export const waitForApiRequest = async (servers: Servers): Promise<void> => {
  const startedAt = Date.now();
  while (servers.api.requests === 0) {
    if (Date.now() - startedAt > 10_000) {
      throw new Error('The lookup never reached the API');
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

export const ageRefreshState = async (
  db: Database,
  key: string,
): Promise<void> => {
  const aged = new Date(Date.now() - 2 * 86_400_000);
  await setRefreshState(db, {
    lastDumpKey: key,
    lastCheckedAt: aged,
    lastImportedAt: aged,
  });
};
