import { cacheTags } from '@notefinder/contracts';

/**
 * The cache tags of the Artist and Album pages a Track is listed on: each
 * Artist's and Album's header and track list. A Track's completion and its
 * metadata import both refresh them, so both build them here.
 */
export const catalogPageTags = (catalog: {
  artistIds: readonly string[];
  albumIds: readonly string[];
}): string[] => [
  ...catalog.artistIds.flatMap((id) => [
    cacheTags.artist(id),
    cacheTags.artistTracks(id),
  ]),
  ...catalog.albumIds.flatMap((id) => [
    cacheTags.album(id),
    cacheTags.albumTracks(id),
  ]),
];
