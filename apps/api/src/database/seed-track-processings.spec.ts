import { SEED_TRACK_PROCESSINGS, SEED_TRACKS } from './seed-data.js';

// The Artist and Album pages list only completed Tracks (ADR 0005), so every
// seeded Track needs one completed Processing for its pages to show.

describe('seed Track processings', () => {
  it('gives every seeded Track exactly one Processing', () => {
    const tracksOfProcessings = SEED_TRACK_PROCESSINGS.map(
      (processing) => processing.trackId,
    );

    expect(SEED_TRACK_PROCESSINGS).toHaveLength(SEED_TRACKS.length);
    expect(new Set(tracksOfProcessings)).toEqual(
      new Set(SEED_TRACKS.map((track) => track.id)),
    );
  });

  it('completes every seeded Processing', () => {
    for (const processing of SEED_TRACK_PROCESSINGS) {
      expect(processing.status).toBe('COMPLETED');
    }
  });

  it('gives every Processing its own ID', () => {
    const ids = SEED_TRACK_PROCESSINGS.map((processing) => processing.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
