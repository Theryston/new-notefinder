import { describe, expect, it } from 'vitest';

import { trackGridMessages } from './track-grid-messages';

describe('trackGridMessages', () => {
  it('resolves every grid string through the translator, by its key', () => {
    expect(trackGridMessages((key) => key)).toEqual({
      title: 'title',
      loading: 'loading',
      loadingMore: 'loadingMore',
      loadMore: 'loadMore',
      empty: { title: 'empty.title', description: 'empty.description' },
      error: {
        title: 'error.title',
        description: 'error.description',
        retry: 'error.retry',
      },
    });
  });
});
