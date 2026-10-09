import { Test, type TestingModule } from '@nestjs/testing';
import { Innertube } from 'youtubei.js';
import { ENV } from '../../config/env.js';
import { YouTubeMusicClient } from './youtube-music.client.js';

// The SDK is replaced at its module boundary: no request leaves the process.
vi.mock('youtubei.js', () => ({ Innertube: { create: vi.fn() } }));

const music = {
  search: vi.fn(),
  getInfo: vi.fn(),
};
const session = { music };

const create = vi.mocked(Innertube.create);

const BRIGHT_DATA_ENV = {
  BRIGHT_DATA_PROXY_HOST: 'brd.superproxy.io',
  BRIGHT_DATA_PROXY_PORT: 33335,
  BRIGHT_DATA_PROXY_USERNAME: 'user',
  BRIGHT_DATA_PROXY_PASSWORD: 'secret',
};

describe('YouTubeMusicClient', () => {
  let client: YouTubeMusicClient;
  let moduleRef: TestingModule;

  const configure = async (env: Record<string, unknown> = {}) => {
    moduleRef = await Test.createTestingModule({
      providers: [YouTubeMusicClient, { provide: ENV, useValue: env }],
    }).compile();
    client = moduleRef.get(YouTubeMusicClient);
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    create.mockResolvedValue(session as unknown as Innertube);
    await configure();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('opens its session on the first request, not at boot', async () => {
    expect(create).not.toHaveBeenCalled();

    music.search.mockResolvedValue({});
    await client.searchSongs('Queen Bohemian Rhapsody');
    await client.searchSongs('Queen Bohemian Rhapsody');

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('searches the songs, mapped to plain videos', async () => {
    music.search.mockResolvedValue({
      songs: {
        contents: [
          {
            id: 'aaaaaaaaaaa',
            title: 'Bohemian Rhapsody',
            item_type: 'song',
            artists: [{ name: 'Queen' }],
            duration: { seconds: 354 },
            thumbnails: [{ url: 'https://img.test/a.jpg', width: 226 }],
          },
        ],
      },
    });

    await expect(
      client.searchSongs('Queen Bohemian Rhapsody'),
    ).resolves.toEqual([
      {
        videoId: 'aaaaaaaaaaa',
        title: 'Bohemian Rhapsody',
        artists: ['Queen'],
        durationSeconds: 354,
        kind: 'song',
        artworkUrl: 'https://img.test/a.jpg',
      },
    ]);
  });

  // The untyped search answers a mixed list of sections with no "songs"
  // shelf and no length on songs, so every search was empty.
  it('asks for a songs-only search, never the mixed one or the videos', async () => {
    music.search.mockResolvedValue({});

    await client.searchSongs('Queen Bohemian Rhapsody');

    expect(music.search).toHaveBeenCalledTimes(1);
    expect(music.search).toHaveBeenCalledWith('Queen Bohemian Rhapsody', {
      type: 'song',
    });
  });

  it('answers no results when the search has no shelves', async () => {
    music.search.mockResolvedValue({});

    await expect(client.searchSongs('nothing')).resolves.toEqual([]);
  });

  it('reads the basic info of a video', async () => {
    music.getInfo.mockResolvedValue({
      basic_info: {
        title: 'Bohemian Rhapsody',
        duration: 355,
        author: 'Queen Official',
        thumbnail: [],
      },
    });

    await expect(client.getVideo('aaaaaaaaaaa')).resolves.toEqual({
      videoId: 'aaaaaaaaaaa',
      title: 'Bohemian Rhapsody',
      artists: ['Queen Official'],
      durationSeconds: 355,
      kind: 'other',
      artworkUrl: null,
    });
    expect(music.getInfo).toHaveBeenCalledWith('aaaaaaaaaaa');
  });

  it('retries opening the session after a failure, instead of keeping it', async () => {
    create.mockRejectedValueOnce(new Error('network down'));

    await expect(client.searchSongs('x')).rejects.toThrow('network down');

    music.search.mockResolvedValue({});
    await expect(client.searchSongs('x')).resolves.toEqual([]);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('uses the global fetch when no proxy is configured', async () => {
    music.search.mockResolvedValue({});

    await client.searchSongs('x');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ fetch: globalThis.fetch }),
    );
  });

  it('routes the session through the Bright Data proxy when it is configured', async () => {
    await moduleRef.close();
    await configure(BRIGHT_DATA_ENV);
    music.search.mockResolvedValue({});

    await client.searchSongs('x');

    const options = create.mock.calls[0]?.[0];
    expect(options?.fetch).toEqual(expect.any(Function));
    expect(options?.fetch).not.toBe(globalThis.fetch);
  });
});
