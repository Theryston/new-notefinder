import { Test, type TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
import { CoverArtClient } from '../../integrations/cover-art/cover-art.client.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { YouTubeMusicClient } from '../../integrations/youtube-music/youtube-music.client.js';
import type { YouTubeVideo } from '../../integrations/youtube-music/youtube-video.js';
import { TrackCoverService } from './track-cover.service.js';
import type { PipelineTrack } from './tracks.repository.js';
import { TracksRepository } from './tracks.repository.js';

// The cover choice and what is stored: the Cover Art Archive first, then the
// artwork the video step found (or the search, when it did not), and a webp
// that fits in 500 px.

const png = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .png()
    .toBuffer();

const track = (overrides: Partial<PipelineTrack> = {}): PipelineTrack => ({
  id: 'track-1',
  title: 'Bohemian Rhapsody',
  lengthMs: 354_000,
  coverUrl: null,
  artistNames: ['Queen'],
  externalUrls: [],
  releases: [
    { mbid: 'release-late', title: 'Greatest Hits', year: 1990 },
    { mbid: 'release-early', title: 'A Night at the Opera', year: 1975 },
  ],
  ...overrides,
});

const searchHit = (overrides: Partial<YouTubeVideo> = {}): YouTubeVideo => ({
  videoId: 'bbbbbbbbbbb',
  title: 'Queen - Bohemian Rhapsody',
  artists: ['Queen'],
  durationSeconds: 354,
  kind: 'song',
  artworkUrl: 'https://img.test/hit.jpg',
  ...overrides,
});

const tracks = {
  findPipelineTrack:
    vi.fn<(trackId: string) => Promise<PipelineTrack | undefined>>(),
  setCoverUrl: vi.fn(),
};
const coverArt = {
  fetchReleaseFrontCover: vi.fn(),
  fetchImage: vi.fn(),
};
const youtube = { searchSongs: vi.fn() };
const storage = {
  putPublicObject: vi.fn(),
  publicUrl: vi.fn((key: string) => `https://files.test/${key}`),
};

describe('TrackCoverService', () => {
  let service: TrackCoverService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackCoverService,
        { provide: TracksRepository, useValue: tracks },
        { provide: CoverArtClient, useValue: coverArt },
        { provide: YouTubeMusicClient, useValue: youtube },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = moduleRef.get(TrackCoverService);
    tracks.findPipelineTrack.mockResolvedValue(track());
    youtube.searchSongs.mockResolvedValue([]);
    coverArt.fetchReleaseFrontCover.mockResolvedValue(undefined);
    coverArt.fetchImage.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  const releaseImage = async () => ({
    bytes: await png(800, 800),
    contentType: 'image/png',
  });

  it('stores nothing for a Track that is unknown or has a cover already', async () => {
    tracks.findPipelineTrack.mockResolvedValueOnce(undefined);
    await expect(service.storeCover('track-1', undefined)).resolves.toBe(false);

    tracks.findPipelineTrack.mockResolvedValueOnce(
      track({ coverUrl: 'https://files.test/old.webp' }),
    );
    await expect(service.storeCover('track-1', undefined)).resolves.toBe(false);

    expect(coverArt.fetchReleaseFrontCover).not.toHaveBeenCalled();
    expect(storage.putPublicObject).not.toHaveBeenCalled();
  });

  it('stores the front cover of the primary release as a webp', async () => {
    coverArt.fetchReleaseFrontCover.mockResolvedValue(await releaseImage());

    await expect(service.storeCover('track-1', null)).resolves.toBe(true);

    expect(coverArt.fetchReleaseFrontCover).toHaveBeenCalledWith(
      'release-early',
    );
    expect(youtube.searchSongs).not.toHaveBeenCalled();
    expect(storage.putPublicObject).toHaveBeenCalledTimes(1);
    const [stored] = storage.putPublicObject.mock.calls[0] ?? [];
    expect(stored).toMatchObject({
      key: 'track-covers/track-1.webp',
      contentType: 'image/webp',
    });
    const metadata = await sharp(stored.body).metadata();
    expect(metadata.format).toBe('webp');
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBe(500);
    expect(tracks.setCoverUrl).toHaveBeenCalledWith(
      'track-1',
      'https://files.test/track-covers/track-1.webp',
    );
  });

  it('falls back to the artwork the video step found, without searching again', async () => {
    coverArt.fetchImage.mockResolvedValue(await releaseImage());

    await expect(
      service.storeCover('track-1', 'https://img.test/found.jpg'),
    ).resolves.toBe(true);

    expect(youtube.searchSongs).not.toHaveBeenCalled();
    expect(coverArt.fetchImage).toHaveBeenCalledWith(
      'https://img.test/found.jpg',
    );
    expect(tracks.setCoverUrl).toHaveBeenCalled();
  });

  it('searches for the artwork itself when the video step did not search', async () => {
    coverArt.fetchImage.mockResolvedValue(await releaseImage());
    youtube.searchSongs.mockResolvedValue([searchHit()]);

    await expect(service.storeCover('track-1', undefined)).resolves.toBe(true);

    expect(youtube.searchSongs).toHaveBeenCalledWith('Queen Bohemian Rhapsody');
    expect(coverArt.fetchImage).toHaveBeenCalledWith(
      'https://img.test/hit.jpg',
    );
  });

  it('searches for the artwork when the Track has no release', async () => {
    tracks.findPipelineTrack.mockResolvedValue(track({ releases: [] }));
    coverArt.fetchImage.mockResolvedValue(await releaseImage());
    youtube.searchSongs.mockResolvedValue([searchHit()]);

    await expect(service.storeCover('track-1', undefined)).resolves.toBe(true);

    expect(coverArt.fetchReleaseFrontCover).not.toHaveBeenCalled();
  });

  it('stores nothing when the archive and the search have no image', async () => {
    await expect(service.storeCover('track-1', null)).resolves.toBe(false);

    expect(coverArt.fetchImage).not.toHaveBeenCalled();
    expect(storage.putPublicObject).not.toHaveBeenCalled();
    expect(tracks.setCoverUrl).not.toHaveBeenCalled();
  });

  it('stores nothing when the search has no match to take artwork from', async () => {
    youtube.searchSongs.mockResolvedValue([
      searchHit({ artists: ['Adele'], title: 'Hello' }),
    ]);

    await expect(service.storeCover('track-1', undefined)).resolves.toBe(false);

    expect(coverArt.fetchImage).not.toHaveBeenCalled();
  });

  it('stores nothing when the downloaded bytes are not an image', async () => {
    coverArt.fetchReleaseFrontCover.mockResolvedValue({
      bytes: new TextEncoder().encode('definitely not a picture'),
      contentType: 'image/png',
    });

    await expect(service.storeCover('track-1', null)).resolves.toBe(false);

    expect(storage.putPublicObject).not.toHaveBeenCalled();
  });
});
