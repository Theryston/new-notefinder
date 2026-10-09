import { describe, expect, it } from 'vitest';

import { youtubeThumbnailUrl, youtubeWatchUrl } from './youtube-links';

describe('youtubeWatchUrl', () => {
  it('links the watch page of the video', () => {
    expect(youtubeWatchUrl('dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });

  it('keeps an ID with a dash or an underscore intact', () => {
    expect(youtubeWatchUrl('a-b_c-d_e-f')).toBe(
      'https://www.youtube.com/watch?v=a-b_c-d_e-f',
    );
  });

  it('encodes what is not part of an ID', () => {
    expect(youtubeWatchUrl('x&y=z')).toBe(
      'https://www.youtube.com/watch?v=x%26y%3Dz',
    );
  });
});

describe('youtubeThumbnailUrl', () => {
  it('points at the medium thumbnail of the video', () => {
    expect(youtubeThumbnailUrl('dQw4w9WgXcQ')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    );
  });
});
