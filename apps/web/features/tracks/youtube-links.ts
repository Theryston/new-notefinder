// The YouTube addresses of a Track's chosen video: the page to watch it, and
// the small thumbnail YouTube serves for it (pure, so both are tested without
// the page).

/** The YouTube page of a video. */
export const youtubeWatchUrl = (videoId: string): string =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

/** The 320 x 180 thumbnail YouTube serves for a video. */
export const youtubeThumbnailUrl = (videoId: string): string =>
  `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
