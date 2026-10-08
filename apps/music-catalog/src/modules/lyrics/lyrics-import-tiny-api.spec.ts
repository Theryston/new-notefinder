import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { LyricsRepository } from './lyrics.repository.js';
import { LyricsImportService } from './lyrics-import.service.js';

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as unknown as Logger;

const row = {
  id: 1,
  mbid: '00000000-0000-4000-8000-000000000001',
  title: 'Yellow',
  lengthMs: 266_000,
  artistCredit: 'Coldplay',
  artistNames: ['Coldplay'],
  albumTitles: ['Parachutes'],
};

describe('LyricsImportService with tiny Lyrics from the API', () => {
  it('keeps the real Lyrics the API answered, never the placeholder text', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lyrics-import-api-'));
    const saved: { mbid: string; plainLyrics: string | null }[] = [];
    const fetchFn = vi.fn(
      async (_url: string | URL | Request) =>
        new Response(
          JSON.stringify({
            trackName: 'Yellow',
            artistName: 'Coldplay',
            albumName: 'Parachutes',
            duration: 267,
            plainLyrics: 'Look at the stars',
            syncedLyrics: '[00:01.00] Look at the stars',
          }),
        ),
    );
    const service = new LyricsImportService({
      bootstrap: {
        getStatus: async () => ({ phase: 'restored', dataset: 'tiny' }),
      } as unknown as BootstrapService,
      recordings: {
        findMatchBatch: async (afterId: number) =>
          row.id > afterId ? [row] : [],
        saveLyrics: async (rows: typeof saved) => {
          saved.push(...rows);
        },
      } as unknown as LyricsRepository,
      dataset: 'tiny',
      lrclibBaseUrl: 'http://localhost',
      lrclibListingUrl: 'http://localhost/listing',
      tinySource: 'api',
      apiBaseUrl: 'https://lrclib.test',
      fetchFn,
      logger,
      tmpDir: dir,
    });

    try {
      await expect(service.importOnce()).resolves.toEqual({
        matched: 1,
        saved: 1,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    expect(saved).toEqual([
      expect.objectContaining({
        mbid: row.mbid,
        plainLyrics: 'Look at the stars',
      }),
    ]);
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain(
      'https://lrclib.test/api/get?',
    );
  });
});
