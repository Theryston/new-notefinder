import {
  HOME_ROW_RULES,
  type HomeLayout,
  type HomeRowRule,
  MAX_TRACKS_PER_ARTIST_PER_ROW,
} from './home-rules.js';

/** What the composer needs to know about a Track to place it in a row. */
export type ComposableTrack = {
  id: string;
  /** The artist the per-row cap counts by (the credit's first artist). */
  artistKey: string;
  hasCover: boolean;
  /** Only Tracks whose Processing completed may appear in the feed. */
  isCompleted: boolean;
};

type RowCandidate<T extends ComposableTrack> = {
  layout: HomeLayout;
  /** Best first: the composer keeps the first eligible ones. */
  items: readonly T[];
};

const isEligible = <T extends ComposableTrack>(
  track: T,
  rule: HomeRowRule,
): boolean => track.isCompleted && (!rule.requiresCover || track.hasCover);

const pickRowItems = <T extends ComposableTrack>(
  candidates: readonly T[],
  rule: HomeRowRule,
  used: ReadonlySet<string>,
): T[] => {
  const picked: T[] = [];
  const perArtist = new Map<string, number>();
  for (const track of candidates) {
    if (picked.length >= rule.maxItems) {
      break;
    }
    const taken = used.has(track.id) || picked.some((p) => p.id === track.id);
    if (taken || !isEligible(track, rule)) {
      continue;
    }
    const count = perArtist.get(track.artistKey) ?? 0;
    if (count >= MAX_TRACKS_PER_ARTIST_PER_ROW) {
      continue;
    }
    perArtist.set(track.artistKey, count + 1);
    picked.push(track);
  }
  return picked;
};

/**
 * Turns candidate rows, in feed order, into the rows of the feed. A Track
 * appears once per feed (the earlier row keeps it), a row keeps at most two
 * Tracks of one artist, a row below its minimum size is dropped (and its
 * Tracks stay free for the rows after it), and each layout's own rule decides
 * eligibility (a hero needs a cover). Pure: the caller loads the candidates and
 * maps the rows it gets back. Row metadata (id, title, sponsored) is kept as is.
 */
export const composeHomeRows = <
  T extends ComposableTrack,
  R extends RowCandidate<T>,
>(
  candidates: readonly R[],
): (R & { items: T[] })[] => {
  const used = new Set<string>();
  const rows: (R & { items: T[] })[] = [];
  for (const candidate of candidates) {
    const rule = HOME_ROW_RULES[candidate.layout];
    const items = pickRowItems(candidate.items, rule, used);
    if (items.length < rule.minItems) {
      continue;
    }
    for (const item of items) {
      used.add(item.id);
    }
    rows.push({ ...candidate, items });
  }
  return rows;
};
