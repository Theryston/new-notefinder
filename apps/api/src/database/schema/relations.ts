import { relations } from 'drizzle-orm';
import { albums } from './albums.js';
import { artists } from './artists.js';
import { thumbnails, trackArtists, trackNotes, tracks } from './tracks.js';

// Relations for the relational query API live in one file so the table files
// never import each other in a cycle.

export const artistsRelations = relations(artists, ({ many }) => ({
  trackArtists: many(trackArtists),
}));

export const albumsRelations = relations(albums, ({ many }) => ({
  tracks: many(tracks),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  album: one(albums, { fields: [tracks.albumId], references: [albums.id] }),
  trackArtists: many(trackArtists),
  thumbnails: many(thumbnails),
  notes: many(trackNotes),
}));

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

export const thumbnailsRelations = relations(thumbnails, ({ one }) => ({
  track: one(tracks, { fields: [thumbnails.trackId], references: [tracks.id] }),
}));

export const trackNotesRelations = relations(trackNotes, ({ one }) => ({
  track: one(tracks, { fields: [trackNotes.trackId], references: [tracks.id] }),
}));
