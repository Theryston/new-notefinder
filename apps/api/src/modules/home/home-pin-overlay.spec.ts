import type { HomeRow, HomeTrack } from '@notefinder/contracts';
import { applyEditorialPins, type OverlayPin } from './home-pin-overlay.js';

const track = (id: string, cover = true): HomeTrack => ({
  id,
  title: `Track ${id}`,
  coverUrl: cover ? `https://cdn.example/${id}.webp` : null,
  artistCredit: [{ name: `Artist ${id}`, joinPhrase: '' }],
  durationMs: null,
  vocalRange: null,
});

/** Six Tracks named `<prefix>-0` to `<prefix>-5`. */
const sixTracks = (prefix: string, cover = true): HomeTrack[] =>
  Array.from({ length: 6 }, (_, i) => track(`${prefix}-${i}`, cover));

const standardRow = (id: string, items: HomeTrack[]): HomeRow => ({
  id,
  layout: 'standard',
  title: { key: `home.rows.${id}`, params: {} },
  items,
});

const heroRow = (id: string, hero: HomeTrack): HomeRow => ({
  id,
  layout: 'hero',
  track: hero,
});

const pin = (id: string, overrides: Partial<OverlayPin> = {}): OverlayPin => ({
  id,
  kind: 'row',
  position: 1,
  priority: 0,
  createdAt: 1,
  sponsored: false,
  title: { key: 'home.rows.pinned', params: { title: `Pin ${id}` } },
  tracks: sixTracks(`${id}-track`),
  ...overrides,
});

const heroPin = (id: string, tracks: HomeTrack[], position = 0) =>
  pin(id, { kind: 'hero', position, tracks });

const rowIds = (rows: HomeRow[]): string[] => rows.map((row) => row.id);

const feed = (): HomeRow[] => [
  heroRow('hero', track('algo-hero')),
  standardRow('a', sixTracks('a')),
  standardRow('b', sixTracks('b')),
  standardRow('c', sixTracks('c')),
];

describe('applyEditorialPins', () => {
  it('keeps the algorithmic rows as they are without pins', () => {
    const rows = feed();

    expect(applyEditorialPins(rows, [])).toEqual(rows);
  });

  it('places a pinned row at its position among the algorithmic rows', () => {
    const rows = applyEditorialPins(feed(), [pin('p', { position: 2 })]);

    expect(rowIds(rows)).toEqual(['hero', 'a', 'pin-p', 'b', 'c']);
  });

  it('lets a pinned row take the next free position after a higher-precedence pin', () => {
    const rows = applyEditorialPins(feed(), [
      pin('low', { position: 1, priority: 1 }),
      pin('high', { position: 1, priority: 5 }),
    ]);

    expect(rowIds(rows)).toEqual([
      'hero',
      'pin-high',
      'pin-low',
      'a',
      'b',
      'c',
    ]);
  });

  it('breaks a priority tie in favour of the most recent pin', () => {
    const rows = applyEditorialPins(feed(), [
      pin('older', { position: 1, createdAt: 10 }),
      pin('newer', { position: 1, createdAt: 20 }),
    ]);

    expect(rowIds(rows)).toEqual([
      'hero',
      'pin-newer',
      'pin-older',
      'a',
      'b',
      'c',
    ]);
  });

  it('replaces the algorithmic hero with a pinned hero and marks it sponsored', () => {
    const rows = applyEditorialPins(feed(), [
      heroPin('hero-pin', [track('pinned-hero')], 0),
    ]);

    expect(rows[0]).toEqual({
      id: 'pin-hero-pin',
      layout: 'hero',
      track: track('pinned-hero'),
    });
    expect(rowIds(rows)).toEqual(['pin-hero-pin', 'a', 'b', 'c']);
  });

  it('flags a pinned hero as sponsored when its pin is sponsored', () => {
    const rows = applyEditorialPins(feed(), [
      pin('hero-pin', {
        kind: 'hero',
        sponsored: true,
        tracks: [track('pinned-hero')],
      }),
    ]);

    expect(rows[0]).toMatchObject({ layout: 'hero', sponsored: true });
  });

  it('shows a sponsored pinned row with the flag and a plain one without it', () => {
    const rows = applyEditorialPins(feed(), [
      pin('ad', { position: 1, sponsored: true }),
      pin('plain', { position: 2 }),
    ]);

    expect(rows[1]).toMatchObject({ id: 'pin-ad', sponsored: true });
    expect(rows[2]).toMatchObject({ id: 'pin-plain' });
    expect(rows[2]).not.toHaveProperty('sponsored');
  });

  it('never flags an algorithmic row as sponsored', () => {
    const rows = applyEditorialPins(feed(), [pin('ad', { sponsored: true })]);

    const algorithmic = rows.filter((row) => !row.id.startsWith('pin-'));
    for (const row of algorithmic) {
      expect(row).not.toHaveProperty('sponsored');
    }
  });

  it('keeps a pinned Track out of the algorithmic rows', () => {
    const rows = applyEditorialPins(feed(), [
      pin('p', {
        position: 1,
        tracks: [
          track('a-0'),
          track('a-1'),
          track('a-2'),
          track('a-3'),
          track('a-4'),
          track('a-5'),
        ],
      }),
    ]);

    const algorithmicIds = rows
      .filter((row) => !row.id.startsWith('pin-'))
      .flatMap((row) => (row.layout === 'standard' ? row.items : []))
      .map((item) => item.id);
    expect(algorithmicIds.some((id) => id.startsWith('a-'))).toBe(false);
  });

  it('drops an algorithmic row that falls below six Tracks after the pins take some', () => {
    const rows = applyEditorialPins(feed(), [
      pin('takes-a', { position: 9, tracks: sixTracks('a').slice(0, 2) }),
    ]);

    // Row `a` keeps 4 of its 6 Tracks, below the minimum: it is dropped.
    expect(rowIds(rows)).toEqual(['hero', 'b', 'c', 'pin-takes-a']);
  });

  it('drops the algorithmic hero when its Track is pinned', () => {
    const rows = applyEditorialPins(
      [heroRow('hero', track('shared')), standardRow('a', sixTracks('a'))],
      [pin('p', { position: 3, tracks: [track('shared')] })],
    );

    expect(rowIds(rows)).toEqual(['a', 'pin-p']);
  });

  it('uses the first Track with a cover for a pinned hero, skipping the others', () => {
    const rows = applyEditorialPins(feed(), [
      heroPin('hero-pin', [track('no-cover', false), track('with-cover')]),
    ]);

    expect(rows[0]).toMatchObject({
      layout: 'hero',
      track: { id: 'with-cover' },
    });
  });

  it('skips a hero pin whose Tracks have no cover, without showing it as a row', () => {
    const rows = applyEditorialPins(feed(), [
      heroPin('no-cover', sixTracks('nc', false), 2),
    ]);

    expect(rowIds(rows)).toEqual(['hero', 'a', 'b', 'c']);
  });

  it('demotes a losing hero pin to a row at the next free position', () => {
    const rows = applyEditorialPins(feed(), [
      heroPin('first', [track('first-hero')], 0),
      heroPin('second', [track('second-hero')], 0),
    ]);

    expect(rowIds(rows)).toEqual(['pin-first', 'pin-second', 'a', 'b', 'c']);
    expect(rows[1]).toMatchObject({
      layout: 'standard',
      items: [track('second-hero')],
    });
  });

  it('keeps a hero that lost to a higher-precedence hero as a row with its own Tracks', () => {
    const rows = applyEditorialPins(feed(), [
      pin('loser', {
        kind: 'hero',
        createdAt: 1,
        tracks: [track('winner-hero'), track('loser-only')],
      }),
      pin('winner', {
        kind: 'hero',
        createdAt: 2,
        tracks: [track('winner-hero')],
      }),
    ]);

    // `winner-hero` is shown by the winning (more recent) hero, so the loser
    // keeps only the Track nobody shows yet.
    expect(rows[0]).toMatchObject({ id: 'pin-winner', layout: 'hero' });
    expect(rows[1]).toMatchObject({
      id: 'pin-loser',
      layout: 'standard',
      items: [track('loser-only')],
    });
  });

  it('shows no hero pin without Tracks, and keeps the algorithmic hero', () => {
    const rows = applyEditorialPins(feed(), [heroPin('empty', [])]);

    expect(rows[0]).toMatchObject({ id: 'hero', layout: 'hero' });
  });

  it('ignores a pin whose Tracks are all gone', () => {
    const rows = applyEditorialPins(feed(), [pin('gone', { tracks: [] })]);

    expect(rowIds(rows)).toEqual(['hero', 'a', 'b', 'c']);
  });

  it('drops a pinned Track another higher-precedence pin already shows', () => {
    const shared = track('shared');
    const rows = applyEditorialPins(feed(), [
      pin('first', { position: 1, priority: 2, tracks: [shared] }),
      pin('second', { position: 2, priority: 1, tracks: [shared] }),
    ]);

    expect(rowIds(rows)).toEqual(['hero', 'pin-first', 'a', 'b', 'c']);
  });

  it('places a row pin at position 0 when there is no hero at all', () => {
    const rows = applyEditorialPins([], [pin('top', { position: 0 })]);

    expect(rowIds(rows)).toEqual(['pin-top']);
  });

  it('places a pin past the end of the algorithmic rows right after the last one (explicit rule)', () => {
    const rows = applyEditorialPins(
      [heroRow('hero', track('h')), standardRow('a', sixTracks('a'))],
      [pin('late', { position: 5 })],
    );

    expect(rowIds(rows)).toEqual(['hero', 'a', 'pin-late']);
  });

  it('caps the feed at 24 rows', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      pin(`p${i}`, { position: 0, createdAt: i, tracks: [track(`t${i}`)] }),
    );

    const rows = applyEditorialPins(feed(), many);

    expect(rows).toHaveLength(24);
  });

  it('returns a hero alone when the feed has no other rows', () => {
    const rows = applyEditorialPins(
      [],
      [heroPin('solo', [track('solo-hero')])],
    );

    expect(rowIds(rows)).toEqual(['pin-solo']);
  });
});
