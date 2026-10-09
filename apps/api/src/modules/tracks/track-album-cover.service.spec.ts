import { Test, type TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
import { CoverArtClient } from '../../integrations/cover-art/cover-art.client.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { TrackAlbumCoverService } from './track-album-cover.service.js';

// An Album's cover: downloaded, re-encoded to a webp and stored under the
// Album's own key; nothing when the archive has none or the bytes are not an
// image.

const coverArt = { fetchImage: vi.fn() };
const storage = {
  putPublicObject: vi.fn(),
  publicUrl: vi.fn((key: string) => `https://cdn.test/${key}`),
};

const COVER_URL =
  'https://coverartarchive.org/release-group/00000000-0000-4000-8000-000000000040/front-500';

/** A real PNG the cover re-encoding can decode. */
const png = async (): Promise<Uint8Array> =>
  new Uint8Array(
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 30, g: 60, b: 90 },
      },
    })
      .png()
      .toBuffer(),
  );

describe('TrackAlbumCoverService', () => {
  let covers: TrackAlbumCoverService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackAlbumCoverService,
        { provide: CoverArtClient, useValue: coverArt },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    covers = moduleRef.get(TrackAlbumCoverService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('stores the cover as a webp under the Album, and answers its public URL', async () => {
    coverArt.fetchImage.mockResolvedValue({
      bytes: await png(),
      contentType: 'image/png',
    });

    await expect(covers.storeCover('album-1', COVER_URL)).resolves.toBe(
      'https://cdn.test/album-covers/album-1.webp',
    );

    expect(coverArt.fetchImage).toHaveBeenCalledWith(COVER_URL);
    expect(storage.putPublicObject).toHaveBeenCalledWith({
      key: 'album-covers/album-1.webp',
      body: expect.any(Uint8Array),
      contentType: 'image/webp',
    });
  });

  it('answers nothing, and stores nothing, when the archive has no cover', async () => {
    coverArt.fetchImage.mockResolvedValue(undefined);

    await expect(covers.storeCover('album-1', COVER_URL)).resolves.toBe(
      undefined,
    );
    expect(storage.putPublicObject).not.toHaveBeenCalled();
  });

  it('answers nothing when the downloaded bytes are not an image', async () => {
    coverArt.fetchImage.mockResolvedValue({
      bytes: new TextEncoder().encode('<html>not an image</html>'),
      contentType: 'image/png',
    });

    await expect(covers.storeCover('album-1', COVER_URL)).resolves.toBe(
      undefined,
    );
    expect(storage.putPublicObject).not.toHaveBeenCalled();
  });
});
