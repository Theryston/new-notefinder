import type { Database } from '../src/database/database.js';
import type { FakeDumpRecording } from '../src/integrations/lrclib/fake-lrclib-dump.js';
import { useTestServer } from './utils/create-test-server.js';
import { setBootstrapState } from './utils/database.js';
import {
  fakeLrclibDumpGz,
  schemaMismatchDumpGz,
  startFakeLrclibServer,
} from './utils/fake-lrclib-server.js';
import { keptLyricsOf } from './utils/kept-lyrics.js';
import { addArtist, addRecording, mbid } from './utils/musicbrainz.js';
import { addRelease, addTrack } from './utils/musicbrainz-relations.js';
import { requestSearch } from './utils/search-client.js';
import {
  createTestWorker,
  indexCatalog,
  useEmptyLyricsIndex,
  useEmptySearchIndex,
} from './utils/test-worker.js';
import { useTestClient } from './utils/use-test-client.js';
import type { TestClient } from './utils/ws-client.js';

const SONG_ONE = mbid(11);
const SONG_TWO = mbid(12);
const SONG_THREE = mbid(13);
const SONG_FOUR = mbid(14);

type Songbook = {
  recordings: FakeDumpRecording[];
};

// Four Recordings with lengths and albums, in a fixed order: the fake dump
// gives the first an exact row (plus near-misses), the second only an album
// tie that must not match, the third an exact row, and the fourth (no
// length) nothing.
const arrangeSongbook = async (db: Database): Promise<Songbook> => {
  const owls = await addArtist(db, { name: 'The Night Owls', mbid: mbid(21) });
  const harbor = await addArtist(db, { name: 'Harbor Lights', mbid: mbid(22) });
  const velvet = await addArtist(db, { name: 'Velvet Static', mbid: mbid(23) });
  const songs = [
    {
      mbid: SONG_ONE,
      name: 'Paper Lanterns',
      artists: [{ artist: owls }],
      lengthMs: 210_000,
      album: 'Evening Static',
    },
    {
      mbid: SONG_TWO,
      name: 'Glass Harbor',
      artists: [{ artist: harbor }],
      lengthMs: 195_000,
      album: 'Tide Charts',
    },
    {
      mbid: SONG_THREE,
      name: 'Neon Orchard',
      artists: [{ artist: velvet }],
      lengthMs: 240_000,
      album: 'Midnight Harvest',
    },
    {
      mbid: SONG_FOUR,
      name: 'Untimed Outro',
      artists: [{ artist: velvet }],
      album: 'Midnight B-Sides',
    },
  ] as const;
  const recordings: FakeDumpRecording[] = [];
  for (const song of songs) {
    const artistNames = song.artists.map((entry) => entry.artist.name);
    const recorded = await addRecording(db, {
      mbid: song.mbid,
      name: song.name,
      artists: song.artists,
      lengthMs: 'lengthMs' in song ? song.lengthMs : undefined,
    });
    const release = await addRelease(db, {
      name: song.album,
      artistCredit: recorded.artistCredit,
    });
    await addTrack(db, { release, recording: recorded });
    recordings.push({
      mbid: song.mbid,
      title: song.name,
      artist: artistNames.join(''),
      lengthMs: 'lengthMs' in song ? song.lengthMs : null,
      albums: [song.album],
    });
  }
  return { recordings } satisfies Songbook;
};

const searchMbids = async (
  client: TestClient,
  query: string,
): Promise<string[]> => {
  const response = await requestSearch(client, { query });
  if (!response.ok) {
    throw new Error(`search failed: ${response.error.code}`);
  }
  return response.result.results.map((result) => result.mbid);
};

describe('lyrics: the LRCLIB import and getRecording (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  useEmptySearchIndex();
  useEmptyLyricsIndex();

  describe('in tiny mode, from the generated fake dump', () => {
    it('returns the matched Lyrics in getRecording, null when unmatched', async () => {
      await arrangeSongbook(server().db);
      await indexCatalog(server());

      await expect(keptLyricsOf(server().db, SONG_ONE)).resolves.toMatchObject({
        plain: expect.stringContaining('fake-lrclib-0'),
        synced: expect.stringContaining('[00:01.00]'),
      });
      await expect(keptLyricsOf(server().db, SONG_TWO)).resolves.toEqual({
        plain: null,
        synced: null,
      });
      await expect(
        keptLyricsOf(server().db, SONG_THREE),
      ).resolves.toMatchObject({
        plain: expect.stringContaining('fake-lrclib-2'),
      });
      await expect(keptLyricsOf(server().db, SONG_FOUR)).resolves.toEqual({
        plain: null,
        synced: null,
      });
    });

    it('never matches a line of the Lyrics: search reads metadata only', async () => {
      await arrangeSongbook(server().db);
      await indexCatalog(server());

      await expect(
        searchMbids(client(), 'fake-lrclib-0 drifting'),
      ).resolves.toEqual([]);
    });
  });

  describe('in full mode, downloading a tiny dump', () => {
    it('imports the dump over HTTP and answers Lyrics like tiny does', async () => {
      const { recordings } = await arrangeSongbook(server().db);
      const lrclib = await startFakeLrclibServer({
        'lrclib-db-dump-20260923T042405Z.sqlite3.gz':
          fakeLrclibDumpGz(recordings),
      });
      try {
        await setBootstrapState(server().db, {
          phase: 'restored',
          dataset: 'full',
        });
        const worker = createTestWorker(server(), {
          env: {
            CATALOG_DATASET: 'full',
            LRCLIB_BASE_URL: lrclib.baseUrl,
            LRCLIB_LISTING_URL: lrclib.listingUrl,
          },
        });
        await worker.tick();

        await expect(
          keptLyricsOf(server().db, SONG_ONE),
        ).resolves.toMatchObject({
          plain: expect.stringContaining('fake-lrclib-0'),
          synced: expect.stringContaining('[00:01.00]'),
        });
        await expect(keptLyricsOf(server().db, SONG_TWO)).resolves.toEqual({
          plain: null,
          synced: null,
        });
        await expect(
          keptLyricsOf(server().db, SONG_THREE),
        ).resolves.toMatchObject({
          plain: expect.stringContaining('fake-lrclib-2'),
        });
        expect(lrclib.requested).toEqual([
          '/listing',
          '/files/lrclib-db-dump-20260923T042405Z.sqlite3.gz',
        ]);
      } finally {
        await lrclib.close();
      }
    });

    it('still becomes ready, without Lyrics, on an unexpected dump schema', async () => {
      await arrangeSongbook(server().db);
      const lrclib = await startFakeLrclibServer({
        'lrclib-db-dump-20260923T042405Z.sqlite3.gz': schemaMismatchDumpGz(),
      });
      try {
        await setBootstrapState(server().db, {
          phase: 'restored',
          dataset: 'full',
        });
        const worker = createTestWorker(server(), {
          env: {
            CATALOG_DATASET: 'full',
            LRCLIB_BASE_URL: lrclib.baseUrl,
            LRCLIB_LISTING_URL: lrclib.listingUrl,
          },
        });
        await worker.tick();

        // The catalog answers: the failed Lyrics import never blocks it.
        await expect(keptLyricsOf(server().db, SONG_ONE)).resolves.toEqual({
          plain: null,
          synced: null,
        });
      } finally {
        await lrclib.close();
      }
    });
  });
});
