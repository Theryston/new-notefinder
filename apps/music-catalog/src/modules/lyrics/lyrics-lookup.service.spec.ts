import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { LyricsDocument } from '../../lib/lyrics-index.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { SyncService } from '../sync/sync.service.js';
import type { OutboxEntry } from '../sync/sync-plan.js';
import type {
  LyricsInsert,
  LyricsRepository,
  MatchingRecording,
} from './lyrics.repository.js';
import {
  type LyricsLookupDeps,
  LyricsLookupService,
} from './lyrics-lookup.service.js';

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

type Stubs = {
  saved: LyricsInsert[][];
  upserted: LyricsDocument[][];
  sleeps: number[];
  queries: string[];
};

const trackResponse = (overrides: Record<string, unknown> = {}): Response =>
  new Response(
    JSON.stringify({
      trackName: 'Yellow',
      artistName: 'Coldplay',
      albumName: 'Parachutes',
      duration: 266.2,
      plainLyrics: 'Look at the stars',
      syncedLyrics: '[00:01.00] Look at the stars',
      ...overrides,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const setup = (
  arranged: {
    recordings: MatchingRecording[];
    entries: OutboxEntry[];
    kept: Map<string, { plain: string | null; synced: string | null }>;
  },
  stubs: Stubs,
  options: Partial<LyricsLookupDeps> & {
    phase?: string;
    status?: number;
    failWith?: Error;
  } = {},
): LyricsLookupService => {
  const { phase = 'ready', status = 200, failWith, ...deps } = options;
  const fetchFn = (async (url: string) => {
    stubs.queries.push(url);
    if (failWith !== undefined) {
      throw failWith;
    }
    if (status === 404) {
      return new Response(JSON.stringify({ message: 'Not found' }), {
        status: 404,
      });
    }
    if (status !== 200) {
      return new Response(JSON.stringify({ message: 'Overloaded' }), {
        status,
      });
    }
    return trackResponse();
  }) as unknown as typeof fetch;
  return new LyricsLookupService({
    bootstrap: {
      getStatus: async () => ({ phase, dataset: 'full' }),
    } as unknown as BootstrapService,
    sync: {
      peekPending: async () => arranged.entries,
    } as unknown as Pick<SyncService, 'peekPending'>,
    recordings: {
      findMatchingByIds: async () => arranged.recordings,
      findKeptByMbids: async () => arranged.kept,
      saveLyrics: async (rows: LyricsInsert[]) => {
        stubs.saved.push(rows);
      },
    } as unknown as LyricsRepository,
    lyricsIndex: {
      upsert: async (documents: LyricsDocument[]) => {
        stubs.upserted.push(documents);
      },
      deleteDocuments: async () => undefined,
    } as unknown as MeilisearchIndex<LyricsDocument>,
    dataset: 'full',
    apiBaseUrl: 'https://lrclib.net',
    logger,
    fetchFn,
    minGapMs: 0,
    sleep: async (ms: number) => {
      stubs.sleeps.push(ms);
    },
    ...deps,
  });
};

const entry = (id: number): OutboxEntry => ({
  recordingId: id,
  recordingMbid: `00000000-0000-4000-8000-00000000000${id}`,
  enqueuedAt: new Date(),
});

describe('LyricsLookupService', () => {
  it('keeps the API Lyrics of an outbox Recording without any', async () => {
    const stubs: Stubs = { saved: [], upserted: [], sleeps: [], queries: [] };
    const service = setup(
      { recordings: [recording()], entries: [entry(1)], kept: new Map() },
      stubs,
    );

    await expect(service.fillFromApi()).resolves.toEqual({ lookedUp: 1 });
    expect(stubs.saved).toHaveLength(1);
    expect(stubs.saved[0]?.[0]).toMatchObject({
      mbid: recording().mbid,
      plainLyrics: 'Look at the stars',
    });
    expect(stubs.upserted.flat().map((doc) => doc.mbid)).toEqual([
      recording().mbid,
    ]);
    expect(stubs.queries).toHaveLength(1);
    expect(stubs.queries[0]).toContain('/api/get?');
  });

  it('skips Recordings that already have Lyrics, or no length', async () => {
    const stubs: Stubs = { saved: [], upserted: [], sleeps: [], queries: [] };
    const withLyrics = recording();
    const withoutLength = recording({
      id: 2,
      mbid: '00000000-0000-4000-8000-000000000002',
      lengthMs: null,
    });
    const service = setup(
      {
        recordings: [withLyrics, withoutLength],
        entries: [entry(1), entry(2)],
        kept: new Map([
          [withLyrics.mbid, { plain: 'kept words', synced: null }],
        ]),
      },
      stubs,
    );

    await expect(service.fillFromApi()).resolves.toEqual({ lookedUp: 0 });
    expect(stubs.queries).toHaveLength(0);
    expect(stubs.saved).toHaveLength(0);
  });

  it('keeps nothing when the strict match disagrees', async () => {
    const stubs: Stubs = { saved: [], upserted: [], sleeps: [], queries: [] };
    // The API answers, but minutes away from the Recording: not the take.
    const far = recording({ lengthMs: 200_000 });
    const service = setup(
      { recordings: [far], entries: [entry(1)], kept: new Map() },
      stubs,
    );

    await expect(service.fillFromApi()).resolves.toEqual({ lookedUp: 0 });
    expect(stubs.saved).toHaveLength(0);
    expect(stubs.upserted).toHaveLength(0);
  });

  it('stays without Lyrics when the API fails, and never throws', async () => {
    for (const options of [{ status: 500 }, { failWith: new Error('down') }]) {
      const stubs: Stubs = { saved: [], upserted: [], sleeps: [], queries: [] };
      const service = setup(
        { recordings: [recording()], entries: [entry(1)], kept: new Map() },
        stubs,
        { ...options, minGapMs: 0 },
      );

      await expect(service.fillFromApi()).resolves.toEqual({ lookedUp: 0 });
      expect(stubs.saved).toHaveLength(0);
    }
  });

  it('asks at most maxPerTick Recordings, politely spaced', async () => {
    const stubs: Stubs = { saved: [], upserted: [], sleeps: [], queries: [] };
    const recordings = [1, 2, 3].map((id) =>
      recording({
        id,
        mbid: `00000000-0000-4000-8000-00000000000${id}`,
      }),
    );
    const service = setup(
      {
        recordings,
        entries: recordings.map((row) => entry(row.id)),
        kept: new Map(),
      },
      stubs,
      { maxPerTick: 2, minGapMs: 500 },
    );

    await expect(service.fillFromApi()).resolves.toEqual({ lookedUp: 2 });
    expect(stubs.queries).toHaveLength(2);
    expect(stubs.sleeps).toEqual([500]);
  });

  it('does nothing before the catalog is ready, or in tiny mode', async () => {
    for (const options of [
      { phase: 'indexing' },
      { dataset: 'tiny' as const },
    ]) {
      const stubs: Stubs = { saved: [], upserted: [], sleeps: [], queries: [] };
      const service = setup(
        { recordings: [recording()], entries: [entry(1)], kept: new Map() },
        stubs,
        { ...options, minGapMs: 0 },
      );

      await expect(service.fillFromApi()).resolves.toEqual({ lookedUp: 0 });
      expect(stubs.queries).toHaveLength(0);
    }
  });
});
