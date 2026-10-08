import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern';
import { describe, expect, it } from 'vitest';

import nextConfig from './next.config';

// The image optimizer refuses any remote URL these patterns do not admit, so
// each cover URL the API hands out needs a matching pattern. Next's own
// matcher decides here, the same one the optimizer uses.
const remotePatterns = nextConfig.images?.remotePatterns ?? [];
const admitted = (url: string): boolean =>
  hasRemoteMatch([], remotePatterns, new URL(url));

describe('image remote patterns', () => {
  it('admit the front cover of an album (a release group)', () => {
    expect(
      admitted(
        'https://coverartarchive.org/release-group/00000000-0000-4000-8000-00000000a001/front-500',
      ),
    ).toBe(true);
  });

  it('still admit the front cover of a track release', () => {
    expect(
      admitted(
        'https://coverartarchive.org/release/a1b2c3d4-e5f6-4a7b-8c9d-e0f123456789/front-500',
      ),
    ).toBe(true);
  });

  it('admit no other host', () => {
    expect(
      admitted(
        'https://example.com/release-group/00000000-0000-4000-8000-00000000a001/front-500',
      ),
    ).toBe(false);
  });
});
