/**
 * Every string the shared paginated track grid shows. The page that owns the
 * grid resolves them from its own messages block, so the grid itself knows
 * no feature namespace (`artists.tracks` today, `albums.tracks` next).
 */
export type TrackGridMessages = {
  title: string;
  loading: string;
  loadingMore: string;
  loadMore: string;
  empty: { title: string; description: string };
  error: { title: string; description: string; retry: string };
};

type TrackGridMessageKey =
  | 'title'
  | 'loading'
  | 'loadingMore'
  | 'loadMore'
  | 'empty.title'
  | 'empty.description'
  | 'error.title'
  | 'error.description'
  | 'error.retry';

/**
 * Resolves the grid strings through a translator scoped to the owning
 * page's block. It runs on the server, so the client grid receives plain
 * strings and needs no message namespace of its own.
 */
export function trackGridMessages(
  translate: (key: TrackGridMessageKey) => string,
): TrackGridMessages {
  return {
    title: translate('title'),
    loading: translate('loading'),
    loadingMore: translate('loadingMore'),
    loadMore: translate('loadMore'),
    empty: {
      title: translate('empty.title'),
      description: translate('empty.description'),
    },
    error: {
      title: translate('error.title'),
      description: translate('error.description'),
      retry: translate('error.retry'),
    },
  };
}
