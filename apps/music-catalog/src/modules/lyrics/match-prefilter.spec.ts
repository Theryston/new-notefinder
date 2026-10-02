import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { writeFakeLrclibDump } from '../../integrations/lrclib/fake-lrclib-dump.js';
import {
  type LrclibCandidateQuery,
  openLrclibDump,
} from '../../integrations/lrclib/lrclib-dump.js';
import { normalizeLyricsText } from '../../lib/normalize-text.js';
import { matchLrclibTrack } from './match-lyrics.js';

const TITLE = 'Café (Lumière!)';
const ARTIST = 'Zoé Brönte';
const ALBUM = 'Été Perpétuel';
const LENGTH_MS = 200_000;

// What the import binds for a Recording: both the raw-lowercase and the
// normalized spelling, since the dump's `_lower` columns may hold either.
const queryFor = (title: string, artist: string): LrclibCandidateQuery => ({
  titleLower: title.toLowerCase(),
  titleNormalized: normalizeLyricsText(title),
  artistLower: artist.toLowerCase(),
  artistNormalized: normalizeLyricsText(artist),
  minDuration: LENGTH_MS / 1000 - 2.5,
  maxDuration: LENGTH_MS / 1000 + 2.5,
});

const withDump = (title: string, work: (path: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), 'match-prefilter-'));
  try {
    const path = join(dir, 'lrclib.sqlite3');
    writeFakeLrclibDump(path, [
      {
        mbid: '00000000-0000-4000-8000-000000000001',
        title,
        artist: ARTIST,
        lengthMs: LENGTH_MS,
        albums: [ALBUM],
      },
    ]);
    work(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('pass one and pass two agree on normalization', () => {
  it('fetches an accented, punctuated track through the normalized columns', () => {
    withDump(TITLE, (path) => {
      // The raw-lowercase spellings match nothing here: only the normalized
      // form may fetch the rows, and the strict match still confirms them.
      const dump = openLrclibDump(path);
      try {
        const candidates = dump.findCandidates(queryFor(TITLE, ARTIST));
        // The exact row and the length near-miss (rejected on duration).
        expect(candidates).toHaveLength(2);
        const matched = matchLrclibTrack(
          {
            mbid: 'mbid',
            title: TITLE,
            lengthMs: LENGTH_MS,
            artistNames: [ARTIST],
            albumTitles: [ALBUM],
          },
          candidates,
        );
        expect(matched?.title).toBe(TITLE);
      } finally {
        dump.close();
      }
    });
  });

  it('matches a plain-ASCII spelling of the same accented track', () => {
    withDump(TITLE, (path) => {
      // Spelling divergence: MusicBrainz spells it without accents, LRCLIB
      // with them. Raw-lowercase equality holds on neither side, so only
      // the normalized form may fetch the rows; dropping them here used to
      // lose the match before the strict comparison ever ran.
      const dump = openLrclibDump(path);
      try {
        const candidates = dump.findCandidates(
          queryFor('Cafe (Lumiere!)', 'Zoe Bronte'),
        );
        expect(candidates).toHaveLength(2);
        const matched = matchLrclibTrack(
          {
            mbid: 'mbid',
            title: 'Cafe (Lumiere!)',
            lengthMs: LENGTH_MS,
            artistNames: ['Zoe Bronte'],
            albumTitles: ['Ete Perpetuel'],
          },
          candidates,
        );
        expect(matched?.title).toBe(TITLE);
      } finally {
        dump.close();
      }
    });
  });

  it('fetches real-dump-style rows, with simple-lowercase columns, too', () => {
    withDump('Café Lumière', (path) => {
      const db = new DatabaseSync(path);
      try {
        // The same track as upstream spells it: accents kept, lowercase
        // only, on another album (so it loses the tie-break).
        db.prepare(
          `INSERT INTO tracks (name, name_lower, artist_name,
            artist_name_lower, album_name, album_name_lower, duration,
            last_lyrics_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        ).run(
          'Café Lumière',
          'café lumière',
          'Zoé Brönte',
          'zoé brönte',
          'Ete Autre',
          'ete autre',
          LENGTH_MS / 1000,
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
        );
      } finally {
        db.close();
      }
      const dump = openLrclibDump(path);
      try {
        const candidates = dump.findCandidates(
          queryFor('Café Lumière', ARTIST),
        );
        const albums = candidates.map((candidate) => candidate.album);
        // The generated row, through the normalized spelling, and the
        // upstream-style row, through the raw one.
        expect(albums).toContain(ALBUM);
        expect(albums).toContain('Ete Autre');
        const matched = matchLrclibTrack(
          {
            mbid: 'mbid',
            title: 'Café Lumière',
            lengthMs: LENGTH_MS,
            artistNames: [ARTIST],
            albumTitles: [ALBUM],
          },
          candidates,
        );
        expect(matched?.album).toBe(ALBUM);
      } finally {
        dump.close();
      }
    });
  });
});
