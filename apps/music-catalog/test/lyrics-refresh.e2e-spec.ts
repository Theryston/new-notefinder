import { LRCLIB_API_USER_AGENT } from '../src/integrations/lrclib/lrclib-api.js';
import { useTestServer } from './utils/create-test-server.js';
import { fakeLrclibDumpGz } from './utils/fake-lrclib-server.js';
import { setRefreshState } from './utils/lrclib-refresh-state.js';
import {
  addLateSong,
  ageRefreshState,
  arrangeDuo,
  DUMP_ONE,
  DUMP_THREE,
  DUMP_TWO,
  lyricsOf,
  REC_A,
  REC_B,
  refreshedDumpGz,
  searchMbids,
  startServers,
  statusPhase,
  tickFirst,
  tickWorker,
  waitForApiRequest,
} from './utils/lyrics-refresh-setup.js';
import { mbid } from './utils/musicbrainz.js';
import {
  useEmptyLyricsIndex,
  useEmptySearchIndex,
} from './utils/test-worker.js';
import { useTestClient } from './utils/use-test-client.js';

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
          [DUMP_THREE]: refreshedDumpGz(recordings, 'third-pressing'),
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

        // Once the minimum interval passes, the skipped dump is still
        // imported: waiting it out lost nothing.
        const past = new Date(Date.now() - 31 * 86_400_000);
        await setRefreshState(server().db, {
          lastDumpKey: DUMP_TWO,
          lastCheckedAt: past,
          lastImportedAt: past,
        });
        await tickWorker(server(), third, {
          LRCLIB_REFRESH_MIN_INTERVAL_DAYS: '30',
        });
        await expect(lyricsOf(client(), REC_A)).resolves.toMatchObject({
          plain: expect.stringContaining('third-pressing'),
        });
        const found = await searchMbids(
          client(),
          'third-pressing still drifting',
          'lyrics',
        );
        expect(found[0]).toBe(REC_A);
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

  it('fills a Recording added after ready from the API', async () => {
    const recordings = await arrangeDuo(server().db);
    const servers = await startServers({
      dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
    });
    try {
      await tickFirst(server(), servers);

      const late = await addLateSong(server().db, {
        mbid: mbid(33),
        title: 'Paper Lanterns',
        artist: 'Paper Foxes',
        album: 'Night Markets',
        lengthMs: 220_000,
      });
      const withApi = await startServers({
        dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
        apiTracks: [
          {
            trackName: late.title,
            artistName: late.artist,
            albumName: late.albums[0] ?? '',
            duration: (late.lengthMs ?? 0) / 1000,
            plainLyrics: 'Lantern words only the API knows',
            syncedLyrics: '[00:01.00] Lantern words only the API knows',
          },
        ],
      });
      try {
        await tickWorker(server(), withApi);

        await expect(lyricsOf(client(), late.mbid)).resolves.toMatchObject({
          plain: expect.stringContaining('Lantern words'),
        });
        const found = await searchMbids(
          client(),
          'Lantern words only the API knows',
          'lyrics',
        );
        expect(found).toContain(late.mbid);
        // The outbox drained behind the lookup: the metadata index answers.
        const metadata = await searchMbids(
          client(),
          'Paper Lanterns',
          'metadata',
        );
        expect(metadata).toContain(late.mbid);
      } finally {
        await withApi.close();
      }
    } finally {
      await servers.close();
    }
  });

  it('drains the outbox while an API lookup hangs', async () => {
    const recordings = await arrangeDuo(server().db);
    const servers = await startServers({
      dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
    });
    try {
      await tickFirst(server(), servers);

      const late = await addLateSong(server().db, {
        mbid: mbid(34),
        title: 'Harbor Static',
        artist: 'Paper Foxes',
        album: 'Night Markets',
        lengthMs: 230_000,
      });
      let releaseApi = (): void => undefined;
      const apiGate = new Promise<void>((resolve) => {
        releaseApi = resolve;
      });
      const hanging = await startServers({
        dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
        apiTracks: [
          {
            trackName: late.title,
            artistName: late.artist,
            albumName: late.albums[0] ?? '',
            duration: (late.lengthMs ?? 0) / 1000,
            plainLyrics: 'Harbor words held back by the API',
            syncedLyrics: '[00:01.00] Harbor words held back by the API',
          },
        ],
        apiBeforeResponse: () => apiGate,
      });
      try {
        const ticking = tickWorker(server(), hanging);
        try {
          await waitForApiRequest(hanging);
          // The drain ran before the lookup even asked: the metadata index
          // answers while the API still holds every response.
          const metadata = await searchMbids(
            client(),
            'Harbor Static',
            'metadata',
          );
          expect(metadata).toContain(late.mbid);
        } finally {
          releaseApi();
        }
        await ticking;

        await expect(lyricsOf(client(), late.mbid)).resolves.toMatchObject({
          plain: expect.stringContaining('held back by the API'),
        });
      } finally {
        await hanging.close();
      }
    } finally {
      await servers.close();
    }
  });

  it('rejects an API track outside the strict match window', async () => {
    const recordings = await arrangeDuo(server().db);
    const servers = await startServers({
      dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
    });
    try {
      await tickFirst(server(), servers);

      const late = await addLateSong(server().db, {
        mbid: mbid(35),
        title: 'Tin Echoes',
        artist: 'Paper Foxes',
        album: 'Night Markets',
        lengthMs: 240_000,
      });
      // Thirty seconds away from the Recording: not the same take. Served
      // verbatim, so the fake's echo cannot hide the mismatch. (The album
      // tie-break needs several passing tracks, which the single-track
      // endpoint never returns, so duration is the rejection path here.)
      const strict = await startServers({
        dumps: { [DUMP_ONE]: fakeLrclibDumpGz(recordings) },
        apiTracks: [
          {
            trackName: late.title,
            artistName: late.artist,
            albumName: late.albums[0] ?? '',
            duration: (late.lengthMs ?? 0) / 1000 + 30,
            plainLyrics: 'Words that are not this take',
            syncedLyrics: '[00:01.00] Words that are not this take',
          },
        ],
        apiVerbatimTitles: [late.title],
      });
      try {
        await tickWorker(server(), strict);

        await expect(lyricsOf(client(), late.mbid)).resolves.toEqual({
          plain: null,
          synced: null,
        });
        // Rejected Lyrics never reach the index, while the outbox drains.
        await expect(
          searchMbids(client(), 'Words that are not this take', 'lyrics'),
        ).resolves.not.toContain(late.mbid);
        const metadata = await searchMbids(client(), 'Tin Echoes', 'metadata');
        expect(metadata).toContain(late.mbid);
      } finally {
        await strict.close();
      }
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
