import {
  type EditorialPin,
  type EditorialPinAudience,
  type EditorialPinDynamicSource,
  type EditorialPinKind,
  type EditorialPinLayout,
  type EditorialPinState,
  type EditorialPinTitles,
  LOCALES,
  type Locale,
} from '@vozzify/contracts';

/** A pin as the database holds it: its fields with the Tracks, in order. */
export type EditorialPinWrite = {
  kind: EditorialPinKind;
  layout: EditorialPinLayout;
  position: number;
  priority: number;
  audience: EditorialPinAudience;
  locale: Locale | null;
  startsAt: Date | null;
  endsAt: Date | null;
  titles: EditorialPinTitles;
  sponsored: boolean;
  /** The Tracks of a `tracks` source; empty for the other sources. */
  trackIds: string[];
  /** The genre, artist or album a pin reads at feed time; null for `tracks`. */
  dynamicSource?: EditorialPinDynamicSource | null;
};

/**
 * Tracks a row built from a genre, artist or album must have to be published:
 * the minimum of a standard row of the home feed. A hero needs one with a cover.
 */
export const DYNAMIC_ROW_MIN_TRACKS = 6;

/** How a dynamic source is read: the Tracks it offers, best first. */
export type SourceTrackQuery = { requireCover: boolean; limit: number };

/**
 * The last row of a page: its creation time and its ID. The
 * cursor of the next page encodes it.
 */
export type PageCursor = { createdAt: Date; id: string };

/** Every field a history entry can name in `changedFields`. */
export const EDITORIAL_PIN_STATE_FIELDS = [
  'kind',
  'layout',
  'source',
  'position',
  'priority',
  'audience',
  'locale',
  'startsAt',
  'endsAt',
  'titles',
  'sponsored',
] as const satisfies readonly (keyof EditorialPinState)[];

const isoOrNull = (date: Date | null): string | null =>
  date ? date.toISOString() : null;

/** The state a pin is in, as the API and the history name it. */
export const stateOf = (pin: EditorialPinWrite): EditorialPinState => ({
  kind: pin.kind,
  layout: pin.layout,
  source: pin.dynamicSource
    ? { ...pin.dynamicSource }
    : { type: 'tracks', trackIds: [...pin.trackIds] },
  position: pin.position,
  priority: pin.priority,
  audience: pin.audience,
  locale: pin.locale,
  startsAt: isoOrNull(pin.startsAt),
  endsAt: isoOrNull(pin.endsAt),
  titles: { ...pin.titles },
  sponsored: pin.sponsored,
});

/**
 * The fields whose value differs between two states. Titles compare per
 * locale, so the order of their keys never counts as a change.
 */
export const changedFieldsOf = (
  before: EditorialPinState,
  after: EditorialPinState,
): string[] =>
  EDITORIAL_PIN_STATE_FIELDS.filter(
    (field) =>
      JSON.stringify(comparable(before, field)) !==
      JSON.stringify(comparable(after, field)),
  );

const comparable = (state: EditorialPinState, field: string): unknown => {
  if (field === 'titles') {
    return LOCALES.map((locale) => state.titles[locale] ?? null);
  }
  if (field === 'source') {
    return state.source;
  }
  return state[field as keyof Omit<EditorialPinState, 'source'>];
};

/** The locales whose home a pin on `locale` shows in: one, or all of them. */
export const affectedLocales = (locale: Locale | null): Locale[] =>
  locale ? [locale] : [...LOCALES];

/** The API shape of a stored pin, with its audit fields. */
export const toEditorialPin = (
  pin: EditorialPinWrite & {
    id: string;
    createdBy: { id: string; name: string } | null;
    updatedBy: { id: string; name: string } | null;
    createdAt: Date;
    updatedAt: Date;
  },
): EditorialPin => ({
  id: pin.id,
  ...stateOf(pin),
  createdBy: pin.createdBy,
  updatedBy: pin.updatedBy,
  createdAt: pin.createdAt.toISOString(),
  updatedAt: pin.updatedAt.toISOString(),
});
