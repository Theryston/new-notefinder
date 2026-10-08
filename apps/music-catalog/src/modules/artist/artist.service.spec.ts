import { CatalogError } from '../../errors/catalog-error.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { ArtistRepository } from './artist.repository.js';
import { ArtistService } from './artist.service.js';
import type { ArtistRow } from './artist-data.js';

const MBID = '00000000-0000-4000-8000-000000000001';
const OLD_MBID = '00000000-0000-4000-8000-000000000002';
const ROCK = '00000000-0000-4000-8000-000000000501';

const row: ArtistRow = { id: 4, mbid: MBID, name: 'Queen' };

const setup = (
  overrides: Partial<Record<keyof ArtistRepository, unknown>> = {},
) => {
  const repository = {
    findByMbid: vi.fn(async () => row),
    findMergedInto: vi.fn(async () => undefined),
    findTagVotes: vi.fn(async () => []),
    ...overrides,
  };
  const bootstrap = { assertReady: vi.fn(async () => undefined) };
  const service = new ArtistService(
    repository as unknown as ArtistRepository,
    bootstrap as unknown as BootstrapService,
  );
  return { service, repository, bootstrap };
};

describe('ArtistService', () => {
  it('waits for the catalog to be ready before reading anything', async () => {
    const { service, repository, bootstrap } = setup();
    const notReady = new CatalogError('CATALOG_NOT_READY', 'Not ready');
    bootstrap.assertReady.mockRejectedValueOnce(notReady);

    await expect(service.getArtist(MBID)).rejects.toBe(notReady);
    expect(repository.findByMbid).not.toHaveBeenCalled();
  });

  it('answers the artist with its genres, most voted first and only the genres', async () => {
    const { service } = setup({
      findTagVotes: vi.fn(async () => [
        { name: 'live', count: 8, genreMbid: null },
        { name: 'rock', count: 5, genreMbid: ROCK },
        { name: 'classic rock', count: 5, genreMbid: null },
      ]),
    });

    await expect(service.getArtist(MBID)).resolves.toEqual({
      mbid: MBID,
      name: 'Queen',
      genres: [{ mbid: ROCK, name: 'rock', count: 5 }],
    });
  });

  it('answers ARTIST_NOT_FOUND for an MBID it does not know', async () => {
    const { service } = setup({ findByMbid: vi.fn(async () => undefined) });

    await expect(service.getArtist(MBID)).rejects.toMatchObject({
      code: 'ARTIST_NOT_FOUND',
    });
  });

  it('answers ARTIST_MOVED with the new MBID for a merged artist', async () => {
    const { service, repository } = setup({
      findByMbid: vi.fn(async () => undefined),
      findMergedInto: vi.fn(async () => MBID),
    });

    await expect(service.getArtist(OLD_MBID)).rejects.toMatchObject({
      code: 'ARTIST_MOVED',
      newMbid: MBID,
    });
    expect(repository.findTagVotes).not.toHaveBeenCalled();
  });
});
