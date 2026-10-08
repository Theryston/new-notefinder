import { type Recording, recordingSchema } from '@notefinder/contracts';
import { testMbid } from './factories.js';

/**
 * A full Music catalog Recording for the Track request tests, parsed so it
 * never drifts from the contract. Override only what a case is about.
 */
export const recordingFixture = (
  overrides: Partial<Recording> = {},
): Recording =>
  recordingSchema.parse({
    mbid: testMbid(1),
    title: 'Bohemian Rhapsody',
    lengthMs: 354_000,
    disambiguation: 'single version',
    video: false,
    isrcs: ['GBUM71029604'],
    artistCredit: { name: 'Queen', artists: [] },
    releases: [],
    works: [],
    genres: [{ mbid: testMbid(50), name: 'rock', count: 9 }],
    tags: [{ name: 'classic rock', count: 4 }],
    tagsSource: 'recording',
    externalUrls: [],
    lyrics: { plain: null, synced: null },
    ...overrides,
  });
