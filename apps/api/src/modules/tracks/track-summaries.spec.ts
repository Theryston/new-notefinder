import { trackSummarySchema } from '@notefinder/contracts';
import { toTrackSummaries } from './track-summaries.js';
import type { TrackListRow } from './tracks.repository.js';

const row = (id: string, overrides: Partial<TrackListRow> = {}) => ({
  id,
  score: 0,
  createdAt: '2026-01-01 00:00:00+00',
  title: `Title ${id}`,
  durationSeconds: 200,
  albumId: null,
  albumName: null,
  ...overrides,
});

const noRelations = {
  artists: [],
  thumbnails: [],
  vocalRanges: { lowest: [], highest: [] },
};

describe('toTrackSummaries', () => {
  it('joins each track with its own relations, in page order', () => {
    const summaries = toTrackSummaries(
      [row('t2', { albumId: 'al1', albumName: 'Album' }), row('t1')],
      {
        artists: [
          { trackId: 't1', id: 'a1', name: 'Ana' },
          { trackId: 't2', id: 'a2', name: 'Bia' },
          { trackId: 't2', id: 'a1', name: 'Ana' },
        ],
        thumbnails: [
          { trackId: 't2', url: 'https://img/small', width: 60, height: 60 },
          { trackId: 't2', url: 'https://img/big', width: 544, height: 544 },
        ],
        vocalRanges: {
          lowest: [{ trackId: 't2', note: 'E', octave: 2 }],
          highest: [{ trackId: 't2', note: 'A', octave: 4 }],
        },
      },
    );

    expect(summaries).toEqual([
      {
        id: 't2',
        title: 'Title t2',
        durationSeconds: 200,
        artists: [
          { id: 'a2', name: 'Bia' },
          { id: 'a1', name: 'Ana' },
        ],
        album: { id: 'al1', name: 'Album' },
        thumbnails: [
          { url: 'https://img/small', width: 60, height: 60 },
          { url: 'https://img/big', width: 544, height: 544 },
        ],
        vocalRange: {
          lowest: { note: 'E', octave: 2 },
          highest: { note: 'A', octave: 4 },
        },
      },
      {
        id: 't1',
        title: 'Title t1',
        durationSeconds: 200,
        artists: [{ id: 'a1', name: 'Ana' }],
        album: null,
        thumbnails: [],
        vocalRange: null,
      },
    ]);
    for (const summary of summaries) {
      expect(trackSummarySchema.parse(summary)).toEqual(summary);
    }
  });

  it('keeps legacy nulls and leaves out the cursor fields', () => {
    const [summary] = toTrackSummaries(
      [row('t1', { title: null, durationSeconds: null })],
      noRelations,
    );

    expect(summary).toEqual({
      id: 't1',
      title: null,
      durationSeconds: null,
      artists: [],
      album: null,
      thumbnails: [],
      vocalRange: null,
    });
  });

  it('has no vocal range when only one end is known', () => {
    const [summary] = toTrackSummaries([row('t1')], {
      ...noRelations,
      vocalRanges: {
        lowest: [{ trackId: 't1', note: 'C', octave: 3 }],
        highest: [],
      },
    });

    expect(summary?.vocalRange).toBeNull();
  });
});
