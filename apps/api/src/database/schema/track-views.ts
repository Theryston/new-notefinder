import { LOCALES } from '@notefinder/contracts';
import { index, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { tracks } from './tracks.js';
import { users } from './users.js';

/**
 * One visit to a Track page, counted once per browser session. The row's ID is
 * what the browser keeps to attach the User if they sign in later in that
 * session. `userId` is null for a visit by someone not signed in, and also
 * after the User is deleted.
 *
 * Legacy mapping: a legacy `TrackView` is (id, trackId, userId?, createdAt,
 * updatedAt) with the legacy Track ID. The import keeps the view ID,
 * `createdAt` and `updatedAt` (the legacy column is `@updatedAt`, as here),
 * keeps `userId` as is (users keep their IDs), and translates `trackId`
 * through `legacy_track_ids`. A view whose Track has no new equivalent is
 * dropped and listed in the import report. One behavior differs: deleting a
 * User cascaded to their views in the legacy app, while here it sets `userId`
 * to null, so the Track's view count survives; the import only needs the
 * legacy rows, which still point at existing Users. The trending score is not
 * imported: it is derived from these rows, so the import ends by running the
 * score refresh once per Track that has views.
 *
 * `locale` is the language the page was displayed in when the view was
 * recorded, so popularity can be computed per language. Legacy views have no
 * locale (the legacy app did not record one), so the import leaves it null,
 * as does a client that omits it.
 * `clickId` joins an optional home click to this view. Legacy views leave it
 * null, and an unknown click id is retained without preventing the view.
 */
export const trackViewLocale = pgEnum('track_view_locale', LOCALES);

export const trackViews = pgTable(
  'track_views',
  {
    id: id(),
    trackId: text()
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    userId: text().references(() => users.id, { onDelete: 'set null' }),
    clickId: text(),
    locale: trackViewLocale(),
    ...timestamps,
  },
  (table) => [
    // The trending windows count one Track's views by time; the platform
    // averages scan by time alone.
    index().on(table.trackId, table.createdAt),
    index().on(table.createdAt),
    index().on(table.userId),
  ],
);
