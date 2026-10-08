import type { Database } from '../../src/database/database.js';
import { albumDiscs, albumTracks } from '../../src/database/schema/albums.js';

// Fixtures for the album disc and track placements. They live apart from
// `factories.ts`, which stays under the file size gate.

/** A disc of an Album (MusicBrainz numbering, from 1), with its name if any. */
export const createAlbumDisc = async (
  db: Database,
  albumId: string,
  position: number,
  title: string | null = null,
): Promise<void> => {
  await db.insert(albumDiscs).values({ albumId, position, title });
};

/** A processed Track placed on an Album: on a disc, at a track position. */
export const placeAlbumTrack = async (
  db: Database,
  placement: {
    albumId: string;
    trackId: string;
    discPosition: number;
    trackPosition: number;
  },
): Promise<void> => {
  await db.insert(albumTracks).values(placement);
};
