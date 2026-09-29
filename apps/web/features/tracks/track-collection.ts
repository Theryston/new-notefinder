/** A list of tracks with a page of its own: an artist's or an album's. */
export type TrackCollection = { kind: 'artist' | 'album'; id: string };

/** Tracks per page: divisible by every grid column count (2, 3, 4, 6). */
export const TRACK_PAGE_SIZE = 24;

/**
 * The collection's path, the same in the API (`/v1` + path) and on the site
 * (`/<locale>` + path).
 */
export const trackCollectionPath = ({
  kind,
  id,
}: TrackCollection): `/${string}` => `/${kind}s/${encodeURIComponent(id)}`;
