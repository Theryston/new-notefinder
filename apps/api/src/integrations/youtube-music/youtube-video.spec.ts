import {
  youtubeVideoOfInfo,
  youtubeVideoOfSearchItem,
} from './youtube-video.js';

describe('youtubeVideoOfSearchItem', () => {
  it('maps a song result with its artists, length and widest artwork', () => {
    expect(
      youtubeVideoOfSearchItem({
        id: 'aaaaaaaaaaa',
        title: 'Bohemian Rhapsody',
        artists: [{ name: 'Queen' }, { name: 'Guest' }],
        duration: { seconds: 354 },
        item_type: 'song',
        thumbnails: [
          { url: 'https://img.test/small.jpg', width: 60 },
          { url: 'https://img.test/large.jpg', width: 544 },
          { url: 'https://img.test/medium.jpg', width: 226 },
        ],
      }),
    ).toEqual({
      videoId: 'aaaaaaaaaaa',
      title: 'Bohemian Rhapsody',
      artists: ['Queen', 'Guest'],
      durationSeconds: 354,
      kind: 'song',
      artworkUrl: 'https://img.test/large.jpg',
    });
  });

  it('reads a video result as a video, and a missing field as unknown', () => {
    expect(
      youtubeVideoOfSearchItem({
        id: 'bbbbbbbbbbb',
        title: 'Clip',
        item_type: 'video',
        duration: { seconds: 0 },
        thumbnails: [],
      }),
    ).toEqual({
      videoId: 'bbbbbbbbbbb',
      title: 'Clip',
      artists: [],
      durationSeconds: null,
      kind: 'video',
      artworkUrl: null,
    });
  });

  it('treats any other item type as other', () => {
    expect(
      youtubeVideoOfSearchItem({
        id: 'ccccccccccc',
        title: 'Album',
        item_type: 'album',
        thumbnails: [],
      })?.kind,
    ).toBe('other');
  });

  it('skips a result without an ID or a title', () => {
    expect(
      youtubeVideoOfSearchItem({ title: 'No id', thumbnails: [] }),
    ).toBeUndefined();
    expect(
      youtubeVideoOfSearchItem({ id: 'ddddddddddd', thumbnails: [] }),
    ).toBeUndefined();
  });
});

describe('youtubeVideoOfInfo', () => {
  it('maps the basic info of a video, its channel as the artist', () => {
    expect(
      youtubeVideoOfInfo('aaaaaaaaaaa', {
        title: 'Bohemian Rhapsody',
        duration: 355,
        author: 'Queen Official',
        thumbnail: [{ url: 'https://img.test/t.jpg', width: 480 }],
      }),
    ).toEqual({
      videoId: 'aaaaaaaaaaa',
      title: 'Bohemian Rhapsody',
      artists: ['Queen Official'],
      durationSeconds: 355,
      kind: 'other',
      artworkUrl: 'https://img.test/t.jpg',
    });
  });

  it('has no artist and no length when the info names neither', () => {
    expect(youtubeVideoOfInfo('aaaaaaaaaaa', { title: 'Clip' })).toEqual({
      videoId: 'aaaaaaaaaaa',
      title: 'Clip',
      artists: [],
      durationSeconds: null,
      kind: 'other',
      artworkUrl: null,
    });
  });

  it('refuses info without a title', () => {
    expect(youtubeVideoOfInfo('aaaaaaaaaaa', {})).toBeUndefined();
  });
});
