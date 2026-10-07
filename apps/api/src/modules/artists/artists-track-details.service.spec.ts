import { Test } from '@nestjs/testing';
import { artistTracksPageSchema } from '@notefinder/contracts';
import { testMbid } from '../../../test/utils/factories.js';
import { ArtistsRepository } from './artists.repository.js';
import { ArtistsService } from './artists.service.js';

const artist = {
  id: 'artist-1',
  mbid: testMbid(1001),
  name: 'Queen',
  genres: ['rock'],
  trackCount: 1,
};

const track = {
  id: 'track-1',
  title: 'Bohemian Rhapsody',
  lengthMs: 354_000,
  disambiguation: '',
  video: false,
  isrcs: ['GBUM71029604'],
  artists: [{ id: 'artist-1', name: 'Queen' }],
  genres: ['rock'],
  releases: [
    {
      mbid: testMbid(2101),
      title: 'A Night at the Opera',
      year: 1975,
      coverArtUrl: 'https://coverartarchive.org/release/2101/front-500',
    },
  ],
  works: [{ mbid: testMbid(3101), title: 'Bohemian Rhapsody work' }],
  tags: [{ name: 'rock', count: 10 }],
  externalLinks: [
    { url: 'https://open.spotify.com/track/123', linkType: 'streaming' },
  ],
};

describe('ArtistsService track details', () => {
  let service: ArtistsService;
  const repository = {
    findArtistById: vi.fn(),
    findArtistIdByLegacyId: vi.fn(),
    findTracksByArtistId: vi.fn(),
  };

  beforeEach(async () => {
    repository.findArtistById.mockReset();
    repository.findArtistIdByLegacyId.mockReset();
    repository.findTracksByArtistId.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArtistsService,
        { provide: ArtistsRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(ArtistsService);
  });

  it('returns the contracted page with its deeper sections', async () => {
    repository.findArtistById.mockResolvedValue(artist);
    repository.findTracksByArtistId.mockResolvedValue({
      items: [track],
      nextCursor: null,
    });

    const result = await service.getArtistTracks('artist-1', { limit: 20 });

    expect(result).toEqual({ items: [track], nextCursor: null });
    expect(artistTracksPageSchema.parse(result)).toEqual(result);
  });

  it('returns empty sections when the catalog has none', async () => {
    repository.findArtistById.mockResolvedValue(artist);
    const minimal = {
      ...track,
      releases: [],
      works: [],
      tags: [],
      externalLinks: [],
    };
    repository.findTracksByArtistId.mockResolvedValue({
      items: [minimal],
      nextCursor: null,
    });

    const result = await service.getArtistTracks('artist-1', { limit: 20 });

    expect(artistTracksPageSchema.parse(result)).toEqual(result);
  });
});
