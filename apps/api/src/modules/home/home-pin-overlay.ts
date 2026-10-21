import type {
  HomeHero,
  HomeRow,
  HomeRowTitle,
  HomeTrack,
  HomeVocalRangeTrack,
} from '@notefinder/contracts';
import { HOME_MAX_ROWS, HOME_ROW_RULES } from './home-rules.js';

/**
 * A live editorial pin as the overlay places it: its Tracks are already read
 * (completed, in the admin's order) and its title is in the feed's locale.
 */
export type OverlayPin = {
  id: string;
  kind: 'hero' | 'row';
  position: number;
  priority: number;
  /** Creation time in milliseconds: the more recent pin wins a priority tie. */
  createdAt: number;
  sponsored: boolean;
  title: HomeRowTitle;
  tracks: HomeTrack[];
};

/** Most recent first among equal priorities, then a stable order by ID. */
const byPrecedence = (a: OverlayPin, b: OverlayPin): number =>
  b.priority - a.priority ||
  b.createdAt - a.createdAt ||
  a.id.localeCompare(b.id);

const hasCover = (track: HomeTrack): boolean => track.coverUrl !== null;

const rowIdOf = (pin: OverlayPin): string => `pin-${pin.id}`;

/** The flag is present only on a sponsored pin, so algorithmic rows never carry it. */
const sponsoredFlag = (pin: OverlayPin): { sponsored?: true } =>
  pin.sponsored ? { sponsored: true } : {};

const pinnedHero = (pin: OverlayPin, track: HomeTrack): HomeHero => ({
  id: rowIdOf(pin),
  layout: 'hero',
  track,
  ...sponsoredFlag(pin),
});

const pinnedRow = (pin: OverlayPin): HomeRow => ({
  id: rowIdOf(pin),
  layout: 'standard',
  title: pin.title,
  items: pin.tracks,
  ...sponsoredFlag(pin),
});

/**
 * The algorithmic hero, unless one of its Track is pinned: the hero row keeps
 * a single Track, so a pinned copy leaves it with nothing to show.
 */
const algorithmicHero = (
  rows: readonly HomeRow[],
  pinnedIds: ReadonlySet<string>,
): HomeRow | undefined => {
  const [first] = rows;
  if (first?.layout !== 'hero' || pinnedIds.has(first.track.id)) {
    return undefined;
  }
  return first;
};

/**
 * The algorithmic carousel rows without the pinned Tracks. A row that falls
 * below its own layout's minimum size is dropped, as the composer drops it.
 * Rows without Tracks (the daily target strip) pass through: pins place
 * Tracks, so they can neither overlap nor empty them.
 */
const algorithmicRows = (
  rows: readonly HomeRow[],
  pinnedIds: ReadonlySet<string>,
): HomeRow[] =>
  rows.flatMap((row): HomeRow[] => {
    if (row.layout === 'hero') {
      return [];
    }
    if (row.layout === 'vocal-range') {
      // The contract requires a range on every item, so the narrowing below
      // only restates what the feed already guarantees.
      const ranged = row.items.filter(
        (item): item is HomeVocalRangeTrack =>
          item.vocalRange !== null && !pinnedIds.has(item.id),
      );
      return ranged.length >= HOME_ROW_RULES['vocal-range'].minItems
        ? [{ ...row, items: ranged }]
        : [];
    }
    if (row.layout !== 'standard') {
      return [row];
    }
    const items = row.items.filter((item) => !pinnedIds.has(item.id));
    return items.length >= HOME_ROW_RULES.standard.minItems
      ? [{ ...row, items }]
      : [];
  });

/**
 * The pinned rows, in precedence order, each keeping only the Tracks no
 * earlier pin (or the hero) already shows. A pin left without Tracks is gone.
 */
const rowPinsFor = (
  pins: readonly OverlayPin[],
  heroTrack: HomeTrack | undefined,
): OverlayPin[] => {
  const shown = new Set<string>(heroTrack ? [heroTrack.id] : []);
  return pins.flatMap((pin) => {
    const tracks = pin.tracks.filter((track) => !shown.has(track.id));
    for (const track of tracks) {
      shown.add(track.id);
    }
    return tracks.length > 0 ? [{ ...pin, tracks }] : [];
  });
};

/**
 * Places the pinned rows over the algorithmic ones. The hero slot (row 0) goes
 * to the pinned hero, or stays with the algorithmic hero. A pin takes its
 * position; when that slot is taken by a higher-precedence pin, it takes the
 * next free one. Algorithmic rows fill the other slots in order.
 *
 * The one place a position cannot be kept: when the algorithmic rows run out
 * before a pin's position, the pin follows the last row. A feed has no empty
 * slots, so a gap is never rendered; this is the explicit rule for it.
 */
const placeRows = (
  hero: HomeRow | undefined,
  pinned: readonly OverlayPin[],
  algorithmic: readonly HomeRow[],
): HomeRow[] => {
  const taken = new Set<number>(hero ? [0] : []);
  const slots = new Map<number, HomeRow>();
  for (const pin of pinned) {
    let index = pin.position;
    while (taken.has(index)) {
      index += 1;
    }
    taken.add(index);
    slots.set(index, pinnedRow(pin));
  }
  // The hero slot counts even when it is the only row of the feed.
  const lastSlot = Math.max(hero ? 0 : -1, ...slots.keys());
  const queue = [...algorithmic];
  const rows: HomeRow[] = [];
  for (
    let index = 0;
    rows.length < HOME_MAX_ROWS && (queue.length > 0 || index <= lastSlot);
    index += 1
  ) {
    const slot = index === 0 && hero ? hero : slots.get(index);
    const row = slot ?? queue.shift();
    if (row) {
      rows.push(row);
    }
  }
  return rows;
};

/**
 * Applies the live editorial pins over the algorithmic feed rows, at read time.
 * Precedence: the pinned hero, the pinned rows, then the algorithmic rows, which
 * never repeat a pinned Track. A hero pin that loses the hero slot to a higher
 * precedence pin is shown as a row at its position, with its titles. Pure: the
 * caller loads the pins and their Tracks.
 */
export const applyEditorialPins = (
  rows: readonly HomeRow[],
  pins: readonly OverlayPin[],
): HomeRow[] => {
  // A pin with no Track left is skipped. So is a hero pin with no Track that
  // has a cover: a hero cannot show it, and it is not shown as a row either.
  const ordered = [...pins]
    .filter((pin) => pin.tracks.length > 0)
    .filter((pin) => pin.kind !== 'hero' || pin.tracks.some(hasCover))
    .sort(byPrecedence);
  const pinnedIds = new Set(
    ordered.flatMap((pin) => pin.tracks.map((t) => t.id)),
  );
  const heroPin = ordered.find(
    (pin) => pin.kind === 'hero' && pin.tracks.some(hasCover),
  );
  const heroTrack = heroPin?.tracks.find(hasCover);
  const hero =
    heroPin && heroTrack
      ? pinnedHero(heroPin, heroTrack)
      : algorithmicHero(rows, pinnedIds);
  const rowPins = rowPinsFor(
    ordered.filter((pin) => pin !== heroPin),
    heroTrack,
  );
  return placeRows(hero, rowPins, algorithmicRows(rows, pinnedIds));
};
