// What the repository reads for one artist, before the service turns it into
// the protocol's `MusicCatalogArtist`.

export type ArtistRow = {
  /** MusicBrainz's integer id: internal, it disappears on a merge. */
  id: number;
  mbid: string;
  name: string;
};
