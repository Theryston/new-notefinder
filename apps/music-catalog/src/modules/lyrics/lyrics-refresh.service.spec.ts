import {
  fakeLrclibDumpGz,
  startFakeLrclibServer,
} from '../../../test/utils/fake-lrclib-server.js';
import type { FakeDumpRecording } from '../../integrations/lrclib/fake-lrclib-dump.js';
import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { LyricsDocument } from '../../lib/lyrics-index.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type {
  LyricsInsert,
  LyricsRepository,
  MatchingRecording,
} from './lyrics.repository.js';
import type {
  LrclibRefreshState,
  LyricsRefreshRepository,
} from './lyrics-refresh.repository.js';
import {
  type LyricsRefreshDeps,
  LyricsRefreshService,
} from './lyrics-refresh.service.js';

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as unknown as Logger;

const recording = (
  overrides: Partial<MatchingRecording> = {},
): MatchingRecording => ({
  id: 1,
  mbid: '00000000-0000-4000-8000-000000000001',
  title: 'Yellow',
  lengthMs: 266_000,
  artistCredit: 'Coldplay',
  artistNames: ['Coldplay'],
  albumTitles: ['Parachutes'],
  ...overrides,
});

const asFake = (row: MatchingRecording): FakeDumpRecording => ({
  mbid: row.mbid,
  title: row.title,
  artist: row.artistCredit,
  lengthMs: row.lengthMs,
  albums: row.albumTitles,
});

type Stubs = {
  kept: Map<string, { plain: string | null; synced: string | null }>;
  saved: LyricsInsert[][];
  deleted: string[][];
  upserted: LyricsDocument[][];
  removed: string[][];
  checks: { now: Date }[];
  imports: { now: Date; dumpKey: string }[];
};

const freshStubs = (): Stubs => ({
  kept: new Map(),
  saved: [],
  deleted: [],
  upserted: [],
  removed: [],
  checks: [],
  imports: [],
});

const emptyState = (): LrclibRefreshState => ({
  lastDumpKey: null,
  lastCheckedAt: null,
  lastImportedAt: null,
});

const aged = (state: LrclibRefreshState): LrclibRefreshState => ({
  ...state,
  lastCheckedAt: new Date(Date.now() - 2 * 3_600_000),
});

type Wiring = {
  service: LyricsRefreshService;
  stubs: Stubs;
  state: LrclibRefreshState;
  baseUrl: string;
  listingUrl: string;
  requested: () => string[];
};

const wire = async (
  batch: MatchingRecording[],
  dumps: Record<string, FakeDumpRecording[]>,
  state: LrclibRefreshState,
  options: Partial<LyricsRefreshDeps> & {
    phase?: string;
    dataset?: 'tiny' | 'full';
  } = {},
): Promise<Wiring & { close: () => Promise<void> }> => {
  const server = await startFakeLrclibServer(
    Object.fromEntries(
      Object.entries(dumps).map(([key, recordings]) => [
        key,
        fakeLrclibDumpGz(recordings),
      ]),
    ),
  );
  const { phase = 'ready', dataset = 'full', ...deps } = options;
  const stubs = freshStubs();
  const service = new LyricsRefreshService({
    bootstrap: {
      getStatus: async () => ({ phase, dataset }),
    } as unknown as BootstrapService,
    recordings: {
      findMatchBatch: async (afterId: number, limit: number) =>
        batch.filter((row) => row.id > afterId).slice(0, limit),
      findKeptByMbids: async (mbids: string[]) =>
        new Map(
          mbids
            .filter((mbid) => stubs.kept.has(mbid))
            .map((mbid) => [mbid, stubs.kept.get(mbid)] as const),
        ),
      saveLyrics: async (rows: LyricsInsert[]) => {
        stubs.saved.push(rows);
        for (const row of rows) {
          stubs.kept.set(row.mbid, {
            plain: row.plainLyrics,
            synced: row.syncedLyrics,
          });
        }
      },
      deleteLyrics: async (mbids: string[]) => {
        stubs.deleted.push(mbids);
        for (const mbid of mbids) {
          stubs.kept.delete(mbid);
        }
      },
    } as unknown as LyricsRepository,
    refreshState: {
      getState: async () => state,
      // Like the real repository: a check only stamps the poll, never the
      // key. Only a finished import records its key, so a newer dump seen
      // while the minimum interval has not passed is still imported once the
      // interval passes.
      recordCheck: async (now: Date) => {
        stubs.checks.push({ now });
        state.lastCheckedAt = now;
      },
      recordImport: async (now: Date, dumpKey: string) => {
        stubs.imports.push({ now, dumpKey });
        state.lastDumpKey = dumpKey;
        state.lastCheckedAt = now;
        state.lastImportedAt = now;
      },
    } as unknown as LyricsRefreshRepository,
    lyricsIndex: {
      upsert: async (documents: LyricsDocument[]) => {
        stubs.upserted.push(documents);
      },
      deleteDocuments: async (ids: string[]) => {
        stubs.removed.push(ids);
      },
    } as unknown as MeilisearchIndex<LyricsDocument>,
    dataset,
    lrclibBaseUrl: server.baseUrl,
    lrclibListingUrl: server.listingUrl,
    checkIntervalMs: 3_600_000,
    minIntervalDays: 30,
    logger,
    ...deps,
  });
  return {
    service,
    stubs,
    state,
    baseUrl: server.baseUrl,
    listingUrl: server.listingUrl,
    requested: () => server.requested,
    close: () => server.close(),
  };
};

// A newer dump the listing serves while the minimum interval has not passed
// since dump-a was imported: one tick skips it without downloading, and the
// skipped key stays unremembered.
const wireSkippedNewerDump = async (): Promise<
  Wiring & { close: () => Promise<void> }
> => {
  const batch = [recording()];
  const wiring = await wire(
    batch,
    {
      'dump-a.sqlite3.gz': batch.map(asFake),
      'dump-b.sqlite3.gz': batch.map(asFake),
    },
    aged({
      lastDumpKey: 'dump-a.sqlite3.gz',
      lastCheckedAt: null,
      lastImportedAt: new Date(),
    }),
  );
  // The listing only keeps the latest dump, the newer key.
  await expect(wiring.service.refreshOnce()).resolves.toMatchObject({
    refreshed: false,
  });
  expect(
    wiring.requested().filter((path) => path.startsWith('/files/')),
  ).toHaveLength(0);
  expect(wiring.stubs.imports).toHaveLength(0);
  return wiring;
};

describe('LyricsRefreshService', () => {
  it('does nothing before the catalog is ready', async () => {
    const wiring = await wire([recording()], {}, emptyState(), {
      phase: 'indexing',
    });
    try {
      await expect(wiring.service.refreshOnce()).resolves.toEqual({
        refreshed: false,
        changed: 0,
        removed: 0,
      });
      expect(wiring.stubs.checks).toHaveLength(0);
      expect(wiring.stubs.saved).toHaveLength(0);
    } finally {
      await wiring.close();
    }
  });

  it('never touches the network in tiny mode', async () => {
    const wiring = await wire([recording()], {}, emptyState(), {
      dataset: 'tiny',
    });
    try {
      await expect(wiring.service.refreshOnce()).resolves.toEqual({
        refreshed: false,
        changed: 0,
        removed: 0,
      });
      expect(wiring.stubs.checks).toHaveLength(0);
    } finally {
      await wiring.close();
    }
  });

  it('skips the listing poll inside the check interval', async () => {
    const batch = [recording()];
    const wiring = await wire(
      batch,
      { 'dump-a.sqlite3.gz': batch.map(asFake) },
      {
        lastDumpKey: 'dump-a.sqlite3.gz',
        lastCheckedAt: new Date(),
        lastImportedAt: new Date(),
      },
    );
    try {
      await expect(wiring.service.refreshOnce()).resolves.toMatchObject({
        refreshed: false,
      });
      expect(wiring.requested()).toHaveLength(0);
    } finally {
      await wiring.close();
    }
  });

  it('skips a dump it already imported', async () => {
    const batch = [recording()];
    const key = 'dump-a.sqlite3.gz';
    const first = await wire(
      batch,
      { [key]: batch.map(asFake) },
      emptyState(),
      { minIntervalDays: 0 },
    );
    try {
      await first.service.refreshOnce();
      expect(
        first.requested().filter((path) => path.startsWith('/files/')),
      ).toHaveLength(1);

      const second = await wire(
        batch,
        { [key]: batch.map(asFake) },
        aged(first.state),
        { minIntervalDays: 0 },
      );
      try {
        await expect(second.service.refreshOnce()).resolves.toMatchObject({
          refreshed: false,
        });
        expect(
          second.requested().filter((path) => path.startsWith('/files/')),
        ).toHaveLength(0);
        expect(second.stubs.imports).toHaveLength(0);
      } finally {
        await second.close();
      }
    } finally {
      await first.close();
    }
  });

  it('waits out the minimum interval even for a newer dump', async () => {
    const wiring = await wireSkippedNewerDump();
    try {
      // The skipped key is not remembered as imported.
      expect(wiring.state.lastDumpKey).toBe('dump-a.sqlite3.gz');
    } finally {
      await wiring.close();
    }
  });

  it('imports a newer dump skipped during the minimum interval once it passes', async () => {
    const wiring = await wireSkippedNewerDump();
    try {
      expect(wiring.state.lastDumpKey).toBe('dump-a.sqlite3.gz');

      // Past both intervals, the same newer dump is imported: nothing was
      // lost by skipping it earlier.
      const past = new Date(Date.now() - 31 * 86_400_000);
      wiring.state.lastCheckedAt = past;
      wiring.state.lastImportedAt = past;
      await expect(wiring.service.refreshOnce()).resolves.toMatchObject({
        refreshed: true,
      });
      expect(wiring.stubs.imports.map((entry) => entry.dumpKey)).toEqual([
        'dump-b.sqlite3.gz',
      ]);
      expect(wiring.state.lastDumpKey).toBe('dump-b.sqlite3.gz');
    } finally {
      await wiring.close();
    }
  });

  it('reindexes only the Recordings whose Lyrics changed', async () => {
    const batch = [
      recording(),
      recording({
        id: 2,
        mbid: '00000000-0000-4000-8000-000000000002',
        title: 'Creep',
        lengthMs: 238_000,
        artistCredit: 'Radiohead',
        artistNames: ['Radiohead'],
        albumTitles: ['Pablo Honey'],
      }),
      recording({
        id: 3,
        mbid: '00000000-0000-4000-8000-000000000003',
        title: 'Neon Glue',
        lengthMs: 240_000,
        artistCredit: 'Velvet Static',
        artistNames: ['Velvet Static'],
        albumTitles: ['Midnight Harvest'],
      }),
    ];
    const fakes = batch.map(asFake);
    const first = await wire(
      batch,
      { 'dump-a.sqlite3.gz': fakes },
      emptyState(),
      {
        minIntervalDays: 0,
      },
    );
    try {
      await first.service.refreshOnce();
      // The dump matches the first and the third Recording (the second only
      // gets an album tie, which must not match).
      const matched = [batch[0]?.mbid, batch[2]?.mbid].sort();
      expect(
        first.stubs.saved
          .flat()
          .map((row) => row.mbid)
          .sort(),
      ).toEqual(matched);
      expect(
        first.stubs.upserted
          .flat()
          .map((doc) => doc.mbid)
          .sort(),
      ).toEqual(matched);

      // A newer dump with the same content changes nothing: nothing is
      // written or reindexed, but the new key is remembered.
      const second = await wire(
        batch,
        {
          'dump-a.sqlite3.gz': fakes,
          'dump-b.sqlite3.gz': fakes,
        },
        aged(first.state),
        { minIntervalDays: 0 },
      );
      // The kept Lyrics travel with the stubs, the way the table would.
      for (const [mbid, lyrics] of first.stubs.kept) {
        second.stubs.kept.set(mbid, lyrics);
      }
      try {
        await expect(second.service.refreshOnce()).resolves.toMatchObject({
          refreshed: true,
          changed: 0,
          removed: 0,
        });
        expect(second.stubs.saved).toHaveLength(0);
        expect(second.stubs.upserted).toHaveLength(0);
        expect(second.stubs.removed).toHaveLength(0);
        expect(second.state.lastDumpKey).toBe('dump-b.sqlite3.gz');
      } finally {
        await second.close();
      }
    } finally {
      await first.close();
    }
  });

  it('forgets Lyrics the newer dump lost', async () => {
    const batch = [recording()];
    const renamed = [
      { ...batch[0], title: 'Yellow Dune' } as MatchingRecording,
    ];
    const wiring = await wire(
      batch,
      { 'dump-a.sqlite3.gz': renamed.map(asFake) },
      aged(emptyState()),
      { minIntervalDays: 0 },
    );
    wiring.stubs.kept.set(batch[0]?.mbid ?? '', {
      plain: 'stale words nobody sings anymore',
      synced: null,
    });
    try {
      await expect(wiring.service.refreshOnce()).resolves.toMatchObject({
        refreshed: true,
        changed: 0,
        removed: 1,
      });
      expect(wiring.stubs.deleted.flat()).toEqual([batch[0]?.mbid]);
      expect(wiring.stubs.removed.flat()).toEqual([batch[0]?.mbid]);
    } finally {
      await wiring.close();
    }
  });

  it('serves the kept Lyrics when the listing fails', async () => {
    const wiring = await wire([recording()], {}, emptyState(), {
      checkIntervalMs: 0,
      lrclibListingUrl: 'http://127.0.0.1:1/listing',
    });
    try {
      await expect(wiring.service.refreshOnce()).resolves.toMatchObject({
        refreshed: false,
      });
      expect(wiring.stubs.checks).toHaveLength(1);
      expect(wiring.stubs.saved).toHaveLength(0);
    } finally {
      await wiring.close();
    }
  });
});
