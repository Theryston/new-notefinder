import { relations } from 'drizzle-orm';
import { artists, legacyArtistIds, trackArtists } from './artists.js';
import { accounts, sessions } from './auth.js';
import { legacyTrackIds, tracks } from './tracks.js';
import { users } from './users.js';

// Relations for the relational query API live in one file so the table files
// never import each other in a cycle.

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const tracksRelations = relations(tracks, ({ many }) => ({
  legacyIds: many(legacyTrackIds),
  trackArtists: many(trackArtists),
}));

export const legacyTrackIdsRelations = relations(legacyTrackIds, ({ one }) => ({
  track: one(tracks, {
    fields: [legacyTrackIds.trackId],
    references: [tracks.id],
  }),
}));

export const artistsRelations = relations(artists, ({ many }) => ({
  legacyIds: many(legacyArtistIds),
  trackArtists: many(trackArtists),
}));

export const legacyArtistIdsRelations = relations(
  legacyArtistIds,
  ({ one }) => ({
    artist: one(artists, {
      fields: [legacyArtistIds.artistId],
      references: [artists.id],
    }),
  }),
);

export const trackArtistsRelations = relations(trackArtists, ({ one }) => ({
  track: one(tracks, {
    fields: [trackArtists.trackId],
    references: [tracks.id],
  }),
  artist: one(artists, {
    fields: [trackArtists.artistId],
    references: [artists.id],
  }),
}));
