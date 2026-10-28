import type { HomeRow, HomeTrack, TrackVocalRange } from '@vozzify/contracts';
import { buildPersonalVoiceRows } from './home-personal-voice.js';

const USER_RANGE: TrackVocalRange = { lowest: 60, highest: 72 };

const track = (id: string, vocalRange: TrackVocalRange): HomeTrack => ({
  id,
  title: `Track ${id}`,
  coverUrl: null,
  artistCredit: [{ name: `Artist ${id}`, joinPhrase: '' }],
  durationMs: 180_000,
  vocalRange,
});

const rowsOf = (tracks: HomeTrack[]): HomeRow[] => [
  {
    id: 'public-tracks',
    layout: 'standard',
    title: { key: 'home.rows.trendingToday', params: {} },
    items: tracks,
  },
];

const buildRows = (tracks: HomeTrack[], used: string[] = []) =>
  buildPersonalVoiceRows({
    rows: rowsOf(tracks),
    userRange: USER_RANGE,
    discovery: new Map(
      tracks.map((item, index) => [
        item.id,
        {
          trendingScore: tracks.length - index,
          genres: [],
          artistKey: item.artistCredit[0]?.name ?? item.id,
        },
      ]),
    ),
    masteredTrackIds: new Set(),
    alreadyUsedTrackIds: new Set(used),
  });

describe('buildPersonalVoiceRows', () => {
  it('ranks exact fits above Tracks that need small transposition', () => {
    const tracks = [
      ...Array.from({ length: 6 }, (_, index) =>
        track(`exact-${index}`, { lowest: 60, highest: 68 }),
      ),
      track('shifted', { lowest: 59, highest: 69 }),
    ];

    const [within] = buildRows(tracks);

    expect(within?.id).toBe('within-your-voice');
    expect(within?.items.map((item) => item.id)).toEqual([
      ...tracks.slice(0, 6).map((item) => item.id),
      'shifted',
    ]);
    expect(within?.items[0]?.fitsVoice).toBe(true);
    expect(within?.items.at(-1)?.fitsVoice).toBe(false);
  });

  it('puts only small, unfit edge challenges in the challenge row without a transpose cue', () => {
    const tracks = Array.from({ length: 6 }, (_, index) =>
      track(`challenge-${index}`, { lowest: 59, highest: 73 }),
    );

    const [challenge] = buildRows(tracks);

    expect(challenge?.id).toBe('challenge-your-range');
    expect(challenge?.items).toHaveLength(6);
    expect(challenge?.items.every((item) => item.fitsVoice === undefined)).toBe(
      true,
    );
  });

  it('deduplicates candidates and excludes resume and mastered Tracks', () => {
    const tracks = [
      ...Array.from({ length: 8 }, (_, index) =>
        track(`fit-${index}`, { lowest: 60, highest: 68 }),
      ),
    ];
    const duplicate = tracks[0];
    if (!duplicate) throw new Error('No Track fixture');
    const rows = buildPersonalVoiceRows({
      rows: rowsOf([...tracks, duplicate]),
      userRange: USER_RANGE,
      discovery: new Map(),
      masteredTrackIds: new Set(['fit-1']),
      alreadyUsedTrackIds: new Set(['fit-2']),
    });

    expect(rows[0]?.items.map((item) => item.id)).toEqual([
      'fit-0',
      'fit-3',
      'fit-4',
      'fit-5',
      'fit-6',
      'fit-7',
    ]);
  });

  it('drops a row below the shared six-Track minimum', () => {
    const tracks = Array.from({ length: 5 }, (_, index) =>
      track(`fit-${index}`, { lowest: 60, highest: 68 }),
    );

    expect(buildRows(tracks)).toEqual([]);
  });
});
