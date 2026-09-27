/**
 * Cache tags shared by the web (`cacheTag()`) and the API (which asks the web
 * to revalidate them after a mutation), so both sides agree on every name.
 *
 * Naming rule: `entity` or `entity:id` (`entity:id:facet` for a sub-resource),
 * with lowercase kebab-case entity/facet names. IDs are kept verbatim because
 * external ones (YouTube video IDs) are case-sensitive; usernames are
 * lowercased because they are case-insensitive. Tags must stay deterministic
 * and at most 256 characters long (Next.js limit).
 */
export const cacheTags = {
  /** Home page sections (recent, most viewed, …). */
  home: 'home',
  /** Any list of tracks (search results, trending, latest). */
  tracks: 'tracks',
  /** `/sitemap.xml` and the per-entity (tracks, artists, albums) sitemaps. */
  sitemap: 'sitemap',
  track: (trackId: string) => `track:${trackId}`,
  trackNotes: (trackId: string) => `track:${trackId}:notes`,
  trackLyrics: (trackId: string) => `track:${trackId}:lyrics`,
  /** Lookup of the track created from a YouTube video, if any. */
  trackByVideo: (videoId: string) => `track-video:${videoId}`,
  artist: (artistId: string) => `artist:${artistId}`,
  album: (albumId: string) => `album:${albumId}`,
  user: (userId: string) => `user:${userId}`,
  /** Public profile page, addressed by username in the URL. */
  userProfile: (username: string) => `user-profile:${username.toLowerCase()}`,
} as const;
