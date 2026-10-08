import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { writeApiLrclibDump } from './api-lrclib-dump.js';
import type { FakeDumpRecording } from './fake-lrclib-dump.js';

const recording = (
  title: string,
  overrides: Partial<FakeDumpRecording> = {},
): FakeDumpRecording => ({
  mbid: '00000000-0000-4000-8000-000000000001',
  title,
  artist: 'Queen',
  lengthMs: 355_000,
  albums: ['A Night at the Opera'],
  ...overrides,
});

const apiTrack = (name: string, album: string, synced: string | null) => ({
  trackName: name,
  artistName: 'Queen',
  albumName: album,
  duration: 355,
  plainLyrics: `plain ${name}`,
  syncedLyrics: synced,
});

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('writeApiLrclibDump', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'api-lrclib-dump-'));
    vi.clearAllMocks();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const readRows = (path: string) => {
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      return db
        .prepare(
          `SELECT t.name, t.album_name, t.duration, l.plain_lyrics AS plain,
            l.synced_lyrics AS synced, l.has_synced_lyrics AS hasSynced,
            l.source
          FROM tracks t JOIN lyrics l ON l.id = t.last_lyrics_id
          ORDER BY t.id`,
        )
        .all();
    } finally {
      db.close();
    }
  };

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

  it('writes what the API answered, with its own metadata', async () => {
    const path = join(dir, 'dump.sqlite3');
    const fetchFn = vi.fn(async (_url: string | URL | Request) =>
      json(
        apiTrack('Bohemian Rhapsody', 'A Night At The Opera', '[00:01.00] a'),
      ),
    );

    const result = await writeApiLrclibDump(
      path,
      [recording('Bohemian Rhapsody')],
      {
        apiBaseUrl: 'https://lrclib.test',
        logger,
        fetchFn,
        sleep: async () => undefined,
      },
    );

    expect(result).toEqual({ asked: 1, found: 1 });
    expect(readRows(path)).toEqual([
      {
        name: 'Bohemian Rhapsody',
        album_name: 'A Night At The Opera',
        duration: 355,
        plain: 'plain Bohemian Rhapsody',
        synced: '[00:01.00] a',
        hasSynced: 1,
        source: 'lrclib-api',
      },
    ]);
    const url = String(fetchFn.mock.calls[0]?.[0]);
    expect(url).toContain('track_name=Bohemian+Rhapsody');
    expect(url).toContain('duration=355');
  });

  it('keeps a plain-only answer, marking the synced Lyrics absent', async () => {
    const path = join(dir, 'dump.sqlite3');

    await writeApiLrclibDump(path, [recording('God Save the Queen')], {
      apiBaseUrl: 'https://lrclib.test',
      logger,
      fetchFn: async () => json(apiTrack('God Save the Queen', 'x', null)),
      sleep: async () => undefined,
    });

    expect(readRows(path)).toEqual([
      expect.objectContaining({ synced: null, hasSynced: 0 }),
    ]);
  });

  it('tries the next album on a 404, waiting between requests', async () => {
    const path = join(dir, 'dump.sqlite3');
    const sleep = vi.fn(async () => undefined);
    const answers = [
      new Response('{}', { status: 404 }),
      json(apiTrack('Mustapha', 'Jazz', '[00:01.00] a')),
    ];

    const result = await writeApiLrclibDump(
      path,
      [recording('Mustapha', { albums: ['Greatest Hits', 'Jazz'] })],
      {
        apiBaseUrl: 'https://lrclib.test',
        logger,
        fetchFn: async () => answers.shift() ?? json({}, 500),
        sleep,
        minGapMs: 750,
      },
    );

    expect(result).toEqual({ asked: 2, found: 1 });
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(750);
  });

  it('skips a Recording without a length and one the API fails for', async () => {
    const path = join(dir, 'dump.sqlite3');
    const fetchFn = vi.fn(async (_url: string | URL | Request) =>
      json({}, 500),
    );

    const result = await writeApiLrclibDump(
      path,
      [recording('Silent', { lengthMs: null }), recording('Broken')],
      {
        apiBaseUrl: 'https://lrclib.test',
        logger,
        fetchFn,
        sleep: async () => undefined,
      },
    );

    expect(result).toEqual({ asked: 1, found: 0 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'The LRCLIB API failed for a tiny Recording',
      expect.objectContaining({
        mbid: '00000000-0000-4000-8000-000000000001',
      }),
    );
    expect(readRows(path)).toEqual([]);
  });

  it('stops asking once the signal is aborted', async () => {
    const path = join(dir, 'dump.sqlite3');
    const fetchFn = vi.fn(async () => json({}, 404));

    const result = await writeApiLrclibDump(path, [recording('A')], {
      apiBaseUrl: 'https://lrclib.test',
      logger,
      fetchFn,
      signal: AbortSignal.abort(),
    });

    expect(result).toEqual({ asked: 0, found: 0 });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
