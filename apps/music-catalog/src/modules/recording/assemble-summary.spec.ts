import { assembleSummary } from './assemble-summary.js';
import type { TagVotesRow } from './recording-data.js';
import type { RecordingSummaryRow } from './recording-summary-data.js';

const MBID = '00000000-0000-4000-8000-000000000100';
const RELEASE_MBID = '00000000-0000-4000-8000-000000000200';

const genre = (name: string, count: number): TagVotesRow => ({
  name,
  count,
  genreMbid: `00000000-0000-4000-8000-${name.padStart(12, '0')}`,
});

const row = (
  overrides: Partial<RecordingSummaryRow> = {},
): RecordingSummaryRow => ({
  mbid: MBID,
  title: 'Song',
  lengthMs: 185_000,
  disambiguation: 'live',
  video: true,
  artistCreditName: 'Simon & Garfunkel',
  artists: [
    {
      mbid: '00000000-0000-4000-8000-000000000001',
      name: 'Simon',
      creditedName: 'Paul Simon',
      joinPhrase: ' & ',
    },
  ],
  primaryRelease: { mbid: RELEASE_MBID, title: 'Album', year: 1966 },
  genreLevels: { recording: [], release_group: [], artist: [] },
  ...overrides,
});

describe('assembleSummary', () => {
  it('keeps the core fields and the artist credit as the row has them', () => {
    const summary = assembleSummary(row());

    expect(summary).toMatchObject({
      mbid: MBID,
      title: 'Song',
      lengthMs: 185_000,
      disambiguation: 'live',
      video: true,
      artistCredit: {
        name: 'Simon & Garfunkel',
        artists: [
          {
            mbid: '00000000-0000-4000-8000-000000000001',
            name: 'Simon',
            creditedName: 'Paul Simon',
            joinPhrase: ' & ',
          },
        ],
      },
    });
  });

  it('shows the primary release with the Cover Art Archive URL built from its MBID', () => {
    const summary = assembleSummary(row());

    expect(summary.primaryRelease).toEqual({
      mbid: RELEASE_MBID,
      title: 'Album',
      year: 1966,
      coverArtUrl: `https://coverartarchive.org/release/${RELEASE_MBID}/front-500`,
    });
  });

  it('keeps an unknown year unknown', () => {
    const summary = assembleSummary(
      row({
        primaryRelease: { mbid: RELEASE_MBID, title: 'Album', year: null },
      }),
    );

    expect(summary.primaryRelease?.year).toBeNull();
  });

  it('has no primary release for a Recording on no release', () => {
    expect(
      assembleSummary(row({ primaryRelease: null })).primaryRelease,
    ).toBeNull();
  });

  it('lists the genres most voted first', () => {
    const summary = assembleSummary(
      row({
        genreLevels: {
          recording: [genre('folk', 2), genre('rock', 9), genre('pop', 2)],
          release_group: [],
          artist: [],
        },
      }),
    );

    expect(summary.genres.map((g) => [g.name, g.count])).toEqual([
      ['rock', 9],
      ['folk', 2],
      ['pop', 2],
    ]);
    expect(summary.genres[0]).toHaveProperty('mbid');
  });

  it("takes the release groups' genres when the Recording has none of its own, as getRecording does", () => {
    const summary = assembleSummary(
      row({
        genreLevels: {
          recording: [],
          release_group: [genre('folk', 4)],
          artist: [genre('rock', 99)],
        },
      }),
    );

    expect(summary.genres.map((g) => g.name)).toEqual(['folk']);
  });

  it("falls back on the artists' genres last", () => {
    const summary = assembleSummary(
      row({
        genreLevels: {
          recording: [],
          release_group: [],
          artist: [genre('rock', 5)],
        },
      }),
    );

    expect(summary.genres.map((g) => g.name)).toEqual(['rock']);
  });

  it('never mixes levels: the first level with a genre is the only one used', () => {
    const summary = assembleSummary(
      row({
        genreLevels: {
          recording: [genre('rock', 1)],
          release_group: [genre('folk', 50)],
          artist: [genre('pop', 50)],
        },
      }),
    );

    expect(summary.genres.map((g) => g.name)).toEqual(['rock']);
  });

  it('has no genres when no level has one', () => {
    expect(assembleSummary(row()).genres).toEqual([]);
  });
});
