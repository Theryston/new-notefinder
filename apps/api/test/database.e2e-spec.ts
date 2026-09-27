import { asc, count, eq } from 'drizzle-orm';
import type { Database } from '../src/database/database.js';
import { albums } from '../src/database/schema/albums.js';
import { artists } from '../src/database/schema/artists.js';
import {
  thumbnails,
  trackArtists,
  trackNotes,
  tracks,
} from '../src/database/schema/tracks.js';
import { connectTestDatabase, resetDatabase } from './utils/database.js';
import { createAlbum, createArtist, createTrack } from './utils/factories.js';

// Covers the e2e database helpers themselves: migrations applied by the
// global setup, the factories and resetDatabase.
describe('E2E database helpers (e2e)', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(() => {
    ({ db, close } = connectTestDatabase());
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await close();
  });

  const countRows = async (
    table:
      | typeof artists
      | typeof albums
      | typeof tracks
      | typeof trackArtists
      | typeof thumbnails
      | typeof trackNotes,
  ): Promise<number> => {
    const [row] = await db.select({ value: count() }).from(table);
    return row?.value ?? 0;
  };

  it('creates a track with its relations and deterministic defaults', async () => {
    const album = await createAlbum(db);
    const { track, artists: trackArtistList } = await createTrack(db, {
      album,
      notes: [{}, { note: 'C#', octave: 5 }],
    });

    const stored = await db.query.tracks.findFirst({
      where: eq(tracks.id, track.id),
      with: {
        album: true,
        thumbnails: true,
        notes: { orderBy: asc(trackNotes.start) },
        trackArtists: { with: { artist: true } },
      },
    });

    expect(stored).toMatchObject({
      ytId: 'yt-track-1',
      title: 'Track 1',
      status: 'COMPLETED',
      album: { name: 'Album 1', ytId: 'MPRE-album-1' },
      thumbnails: [
        {
          url: 'https://i.ytimg.com/vi/yt-track-1/hqdefault.jpg',
          width: 480,
          height: 360,
        },
      ],
      notes: [
        { note: 'A', octave: 4, start: 0, end: 0.5, frequencyMean: 440 },
        { note: 'C#', octave: 5, start: 0.5, end: 1 },
      ],
      trackArtists: [{ artist: { name: 'Artist 1', ytId: 'UC-artist-1' } }],
    });
    expect(trackArtistList.map((artist) => artist.name)).toEqual(['Artist 1']);
  });

  it('applies overrides and reuses given artists', async () => {
    const singer = await createArtist(db, { name: 'Singer' });
    const { track, thumbnails: created } = await createTrack(db, {
      track: { title: 'Custom', status: 'QUEUED', score: 7 },
      artists: [singer],
      thumbnails: [],
    });

    expect(track).toMatchObject({
      title: 'Custom',
      status: 'QUEUED',
      score: 7,
    });
    expect(created).toEqual([]);
    expect(await countRows(artists)).toBe(1);
  });

  it('resetDatabase empties every table and restarts the sequences', async () => {
    await createTrack(db, { album: await createAlbum(db), notes: [{}] });
    await createTrack(db);

    await resetDatabase(db);

    for (const table of [
      artists,
      albums,
      tracks,
      trackArtists,
      thumbnails,
      trackNotes,
    ]) {
      expect(await countRows(table)).toBe(0);
    }
    const { track } = await createTrack(db);
    expect(track.title).toBe('Track 1');
  });
});
