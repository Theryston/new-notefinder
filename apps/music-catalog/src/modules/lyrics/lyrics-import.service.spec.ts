import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type {
  LyricsRepository,
  MatchingRecording,
} from './lyrics.repository.js';
import {
  type LyricsImportDeps,
  LyricsImportService,
} from './lyrics-import.service.js';

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as unknown as Logger;

type StubRecordings = {
  batches: MatchingRecording[][];
  saved: {
    mbid: string;
    plainLyrics: string | null;
    syncedLyrics: string | null;
  }[][];
};

const stubRecordings = (batches: MatchingRecording[][]): StubRecordings => ({
  batches,
  saved: [],
});

const setup = (
  recordings: StubRecordings,
  phase: string,
  options: Partial<LyricsImportDeps> = {},
): { service: LyricsImportService; stub: StubRecordings; dir: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'lyrics-import-'));
  const bootstrap = {
    getStatus: async () => ({ phase, dataset: 'sample' }),
  };
  const repository = {
    findMatchBatch: async (afterId: number, limit: number) => {
      const batch = recordings.batches.flat().filter((row) => row.id > afterId);
      return batch.slice(0, limit);
    },
    saveLyrics: async (
      rows: {
        mbid: string;
        plainLyrics: string | null;
        syncedLyrics: string | null;
      }[],
    ) => {
      recordings.saved.push(rows);
    },
  };
  const service = new LyricsImportService({
    bootstrap: bootstrap as unknown as BootstrapService,
    recordings: repository as unknown as LyricsRepository,
    dataset: 'sample',
    lrclibBaseUrl: 'http://localhost',
    lrclibListingUrl: 'http://localhost/listing',
    logger,
    tmpDir: dir,
    ...options,
  });
  return { service, stub: recordings, dir };
};

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

const cleanup = (dir: string): void => {
  rmSync(dir, { recursive: true, force: true });
};

describe('LyricsImportService', () => {
  it('matches on track metadata, then keeps only the matched Lyrics', async () => {
    const stub = stubRecordings([
      [
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
          title: 'Silent Song',
          lengthMs: null,
          artistCredit: 'No Length Band',
          artistNames: ['No Length Band'],
          albumTitles: [],
        }),
        recording({
          id: 4,
          mbid: '00000000-0000-4000-8000-000000000004',
          title: 'Café (Lumière!)',
          lengthMs: 200_000,
          artistCredit: 'Zoé Brönte',
          artistNames: ['Zoé Brönte'],
          albumTitles: ['Été Perpétuel'],
        }),
      ],
    ]);
    const { service, dir } = setup(stub, 'indexing');

    const result = await service.importOnce();

    expect(result.matched).toBe(2);
    expect(result.saved).toBe(2);
    const kept = stub.saved.flat();
    expect(kept.map((row) => row.mbid)).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000004',
    ]);
    expect(kept[0]?.plainLyrics).toContain('fake-lrclib-0');
    expect(kept[0]?.syncedLyrics).toContain('[00:01.00]');
    // Accents and punctuation are spelling noise: the accented Recording
    // matches its normalized row through pass one, not around it.
    expect(kept[1]?.plainLyrics).toContain('fake-lrclib-3');
    // The temp dump is deleted afterwards, with the unmatched Lyrics in it.
    expect(readdirSync(dir)).toHaveLength(0);
    cleanup(dir);
  });

  it('skips the import once the catalog is ready, and before the restore', async () => {
    for (const phase of ['ready', 'restoring']) {
      const stub = stubRecordings([[recording()]]);
      const { service, dir } = setup(stub, phase);

      await expect(service.importOnce()).resolves.toEqual({
        matched: 0,
        saved: 0,
      });
      expect(stub.saved).toHaveLength(0);
      expect(readdirSync(dir)).toHaveLength(0);
      cleanup(dir);
    }
  });

  it('fails with a clear error on a dump with an unexpected schema', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lyrics-import-bad-'));
    const raw = join(dir, 'broken.sqlite3');
    const broken = join(dir, 'broken.sqlite3.gz');
    const db = new DatabaseSync(raw);
    db.exec(
      'CREATE TABLE tracks (id INTEGER, name TEXT); CREATE TABLE lyrics (id INTEGER)',
    );
    db.close();
    writeFileSync(broken, gzipSync(readFileSync(raw)));
    const server = createServer((request, response) => {
      if (request.url === '/listing') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{"objects":[{"key":"broken.sqlite3.gz"}]}');
        return;
      }
      if (request.url === '/broken.sqlite3.gz') {
        response.writeHead(200, { 'content-type': 'application/octet-stream' });
        response.end(readFileSync(broken));
        return;
      }
      response.writeHead(404);
      response.end();
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const stub = stubRecordings([[recording()]]);
      const { service, dir: tmp } = setup(stub, 'indexing', {
        dataset: 'full',
        lrclibBaseUrl: baseUrl,
        lrclibListingUrl: `${baseUrl}/listing`,
      });

      await expect(service.importOnce()).rejects.toThrow(
        'LRCLIB dump schema mismatch',
      );
      expect(stub.saved).toHaveLength(0);
      // The downloaded temp file is deleted even on failure.
      expect(readdirSync(tmp)).toHaveLength(0);
      cleanup(tmp);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
      cleanup(dir);
    }
  });
});
