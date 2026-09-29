import type { TrackCollection } from './track-collection';

export const trackKeys = {
  all: ['tracks'] as const,
  /** Pages after the first (the first one is rendered by the server). */
  collectionPages: ({ kind, id }: TrackCollection, firstCursor: string) =>
    [...trackKeys.all, kind, id, 'pages', firstCursor] as const,
};
