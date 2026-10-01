import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  type FakeDumpRecording,
  writeFakeLrclibDump,
} from './fake-lrclib-dump.js';
import { assertLrclibSchema } from './lrclib-schema.js';

const recordings: FakeDumpRecording[] = [
  {
    mbid: '00000000-0000-4000-8000-000000000001',
    title: 'Yellow',
    artist: 'Coldplay',
    lengthMs: 266_000,
    albums: ['Parachutes'],
  },
  {
    mbid: '00000000-0000-4000-8000-000000000002',
    title: 'Creep',
    artist: 'Radiohead',
    lengthMs: 238_000,
    albums: ['Pablo Honey'],
  },
  {
    mbid: '00000000-0000-4000-8000-000000000003',
    title: 'Silent Song',
    artist: 'No Length Band',
    lengthMs: null,
    albums: [],
  },
];

type TrackRow = {
  name: string;
  artist_name: string;
  album_name: string;
  duration: number;
};

const readTracks = (
  path: string,
  where: string,
): (TrackRow & { plain: string | null; synced: string | null })[] => {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return db
      .prepare(
        `SELECT t.name, t.artist_name, t.album_name, t.duration,
          l.plain_lyrics AS plain, l.synced_lyrics AS synced
        FROM tracks t LEFT JOIN lyrics l ON l.track_id = t.id
        WHERE ${where} ORDER BY t.id`,
      )
      .all() as (TrackRow & {
      plain: string | null;
      synced: string | null;
    })[];
  } finally {
    db.close();
  }
};

const withDump = (work: (path: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), 'fake-lrclib-'));
  try {
    const path = join(dir, 'lrclib.sqlite3');
    writeFakeLrclibDump(path, recordings);
    work(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('writeFakeLrclibDump', () => {
  it('writes the real schema, so the importer opens it without a schema error', () => {
    withDump((path) => {
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        expect(() => assertLrclibSchema(db)).not.toThrow();
      } finally {
        db.close();
      }
    });
  });

  it('is deterministic: the same Recordings produce the same rows', () => {
    const first = mkdtempSync(join(tmpdir(), 'fake-lrclib-a-'));
    const second = mkdtempSync(join(tmpdir(), 'fake-lrclib-b-'));
    try {
      const a = join(first, 'lrclib.sqlite3');
      const b = join(second, 'lrclib.sqlite3');
      writeFakeLrclibDump(a, recordings);
      writeFakeLrclibDump(b, recordings);
      expect(readTracks(b, '1 = 1')).toEqual(readTracks(a, '1 = 1'));
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  });

  it('gives the first Recording an exact row with placeholder Lyrics', () => {
    withDump((path) => {
      const rows = readTracks(path, "name_lower = 'yellow'");
      // The exact row and the length near-miss (the live and remix rows
      // carry their own `name_lower`).
      expect(rows).toHaveLength(2);
      const [exact, miss] = rows;
      expect(exact?.album_name).toBe('Parachutes');
      expect(Math.abs((exact?.duration ?? 0) - 266)).toBeLessThanOrEqual(0.25);
      expect(Math.abs((miss?.duration ?? 0) - 266)).toBeGreaterThan(2);
      expect(exact?.plain).toContain('fake-lrclib-0');
      expect(exact?.synced).toContain('[00:01.00]');
    });
  });

  it('includes the live and remix near-misses with their own titles', () => {
    withDump((path) => {
      const rows = readTracks(
        path,
        "name_lower IN ('yellow live', 'yellow remix')",
      );
      expect(rows.map((row) => row.name).sort()).toEqual([
        'Yellow (Live)',
        'Yellow (Remix)',
      ]);
      expect(rows.map((row) => row.artist_name)).toEqual([
        'Coldplay',
        'Coldplay',
      ]);
    });
  });

  it('writes the `_lower` columns normalized, the way the match compares', () => {
    withDump((path) => {
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        const rows = db
          .prepare(
            `SELECT name_lower, artist_name_lower, album_name_lower
            FROM tracks WHERE name = 'Yellow (Live)'`,
          )
          .all() as {
          name_lower: string;
          artist_name_lower: string;
          album_name_lower: string;
        }[];
        expect(rows).toEqual([
          {
            name_lower: 'yellow live',
            artist_name_lower: 'coldplay',
            album_name_lower: 'parachutes',
          },
        ]);
      } finally {
        db.close();
      }
    });
  });

  it('gives the second Recording only an album tie on other albums', () => {
    withDump((path) => {
      const rows = readTracks(path, "name_lower = 'creep'");
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.album_name).sort()).toEqual([
        'Fake Tie Album Alpha',
        'Fake Tie Album Beta',
      ]);
    });
  });

  it('writes no row for a Recording without a length', () => {
    withDump((path) => {
      expect(readTracks(path, "name_lower = 'silent song'")).toHaveLength(0);
    });
  });
});
