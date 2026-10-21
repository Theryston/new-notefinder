import {
  EDITORIAL_PIN_AUDIENCES,
  EDITORIAL_PIN_HISTORY_ACTIONS,
  EDITORIAL_PIN_KINDS,
  EDITORIAL_PIN_LAYOUTS,
  EDITORIAL_PIN_SOURCE_TYPES,
  type EditorialPinState,
  type EditorialPinTitles,
  LOCALES,
} from '@notefinder/contracts';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { albums } from './albums.js';
import { artists } from './artists.js';
import { tracks } from './tracks.js';
import { users } from './users.js';

export const editorialPinKind = pgEnum(
  'editorial_pin_kind',
  EDITORIAL_PIN_KINDS,
);

export const editorialPinLayout = pgEnum(
  'editorial_pin_layout',
  EDITORIAL_PIN_LAYOUTS,
);

export const editorialPinAudience = pgEnum(
  'editorial_pin_audience',
  EDITORIAL_PIN_AUDIENCES,
);

export const editorialPinLocale = pgEnum('editorial_pin_locale', LOCALES);

export const editorialPinSourceType = pgEnum(
  'editorial_pin_source_type',
  EDITORIAL_PIN_SOURCE_TYPES,
);

export const editorialPinHistoryAction = pgEnum(
  'editorial_pin_history_action',
  EDITORIAL_PIN_HISTORY_ACTIONS,
);

/**
 * An editorial pin (CONTEXT.md "Pin"): an admin's hero or row on the home feed.
 * The feed overlays it at read time, so nothing stored for the feed changes
 * when a pin starts or ends. A handful of rows at most, so the live query needs
 * no index. The Tracks, in order, are in `editorial_pin_tracks`.
 */
export const editorialPins = pgTable('editorial_pins', {
  id: id(),
  kind: editorialPinKind().notNull(),
  layout: editorialPinLayout().notNull(),
  position: integer().notNull(),
  priority: integer().notNull().default(0),
  audience: editorialPinAudience().notNull().default('everyone'),
  // Null serves every locale.
  locale: editorialPinLocale(),
  // Null means no start (live as soon as it is saved) or no end (indefinite).
  startsAt: timestamp({ withTimezone: true }),
  endsAt: timestamp({ withTimezone: true }),
  titles: jsonb().$type<EditorialPinTitles>().notNull(),
  sponsored: boolean().notNull().default(false),
  // Where the Tracks come from. `tracks` reads `editorial_pin_tracks`; the other
  // kinds read the Tracks of the source when the feed is read, so only the one
  // column that names the source is set.
  sourceType: editorialPinSourceType().notNull().default('tracks'),
  sourceGenre: text(),
  // Null unless the source names an Artist or an Album; the pin goes with them.
  sourceArtistId: text().references(() => artists.id, { onDelete: 'cascade' }),
  sourceAlbumId: text().references(() => albums.id, { onDelete: 'cascade' }),
  // Null once the admin who did it is removed, so the pin outlives them.
  createdById: text().references(() => users.id, { onDelete: 'set null' }),
  updatedById: text().references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
});

/** The Tracks of a pin, in the order the admin set them. */
export const editorialPinTracks = pgTable(
  'editorial_pin_tracks',
  {
    id: id(),
    pinId: text()
      .notNull()
      .references(() => editorialPins.id, { onDelete: 'cascade' }),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    unique('editorial_pin_tracks_pin_position_unique').on(
      table.pinId,
      table.position,
    ),
    unique('editorial_pin_tracks_pin_track_unique').on(
      table.pinId,
      table.trackId,
    ),
    // Deleting a Track cascades here by Track; the unique pairs above only
    // serve lookups that start with the pin.
    index().on(table.trackId),
  ],
);

/**
 * Every change to a pin, including the sponsored flag, with the admin who made
 * it. `pinId` has no foreign key on purpose: the history of a removed pin stays.
 * `state` is the pin after the change (its last state for a deletion).
 */
export const editorialPinHistory = pgTable(
  'editorial_pin_history',
  {
    id: id(),
    pinId: text().notNull(),
    action: editorialPinHistoryAction().notNull(),
    changedFields: text().array().notNull(),
    state: jsonb().$type<EditorialPinState>().notNull(),
    actorId: text().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [index().on(table.pinId, table.createdAt)],
);
