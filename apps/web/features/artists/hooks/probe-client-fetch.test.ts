import { describe, expect, it } from 'vitest';

import { fetchArtistTracksPage } from './use-artist-tracks';

describe('real client fetch against the fake', () => {
  it('fetches page 2 with the server-issued cursor', async () => {
    const first = await fetchArtistTracksPage({
      artistId: 'clx456def',
      limit: 1,
    });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeTruthy();
    const second = await fetchArtistTracksPage({
      artistId: 'clx456def',
      cursor: first.nextCursor ?? undefined,
      limit: 1,
    });
    expect(second.items).toHaveLength(1);
  });
});
