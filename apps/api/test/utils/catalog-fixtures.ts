import {
  type MusicCatalogArtist,
  type MusicCatalogReleaseGroup,
  type MusicCatalogRepresentativeRelease,
  musicCatalogArtistSchema,
  musicCatalogReleaseGroupSchema,
} from '@notefinder/contracts';
import { testMbid } from './factories.js';

// Music catalog release groups and artists for the metadata import tests,
// parsed by their contracts so they never drift from what the catalog sends.
// Override only what a case is about.

/** A release group (an Album) as the Music catalog describes it. */
export const releaseGroupFixture = (
  overrides: Partial<MusicCatalogReleaseGroup> = {},
): MusicCatalogReleaseGroup => {
  const mbid = overrides.mbid ?? testMbid(40);
  return musicCatalogReleaseGroupSchema.parse({
    mbid,
    title: 'A Night at the Opera',
    primaryType: 'Album',
    secondaryTypes: [],
    firstReleaseYear: 1975,
    genres: [{ mbid: testMbid(60), name: 'rock', count: 7 }],
    artistCredit: {
      name: 'Queen',
      artists: [
        {
          mbid: testMbid(41),
          name: 'Queen',
          creditedName: 'Queen',
          joinPhrase: '',
        },
      ],
    },
    // The archive's URL is built from the MBID, so the default follows it.
    coverArtUrl: `https://coverartarchive.org/release-group/${mbid}/front-500`,
    representativeRelease: null,
    ...overrides,
  });
};

/** The credit "Queen & David Bowie" (Queen first), as the catalog prints it. */
export const queenAndBowieCredit =
  (): MusicCatalogReleaseGroup['artistCredit'] => ({
    name: 'Queen & David Bowie',
    artists: [
      {
        mbid: testMbid(41),
        name: 'Queen',
        creditedName: 'Queen',
        joinPhrase: ' & ',
      },
      {
        mbid: testMbid(42),
        name: 'David Bowie',
        creditedName: 'David Bowie',
        joinPhrase: '',
      },
    ],
  });

/**
 * One medium (disc) of a representative release, holding the given Recordings
 * in track order from 1.
 */
export const representativeMedium = (
  position: number,
  title: string,
  recordings: string[],
): MusicCatalogRepresentativeRelease['media'][number] => ({
  position,
  title,
  tracks: recordings.map((recordingMbid, index) => ({
    position: index + 1,
    recordingMbid,
  })),
});

/** An artist as the Music catalog describes it, with its genres. */
export const artistFixture = (
  overrides: Partial<MusicCatalogArtist> = {},
): MusicCatalogArtist =>
  musicCatalogArtistSchema.parse({
    mbid: testMbid(41),
    name: 'Queen',
    genres: [{ mbid: testMbid(61), name: 'glam rock', count: 3 }],
    ...overrides,
  });
