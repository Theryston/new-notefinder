import type { MusicCatalogArtist } from '@notefinder/contracts';
import { createGetArtistHandler } from './artist.handler.js';
import type { ArtistService } from './artist.service.js';

const MBID = '00000000-0000-4000-8000-000000000001';

const artist: MusicCatalogArtist = { mbid: MBID, name: 'Queen', genres: [] };

const setup = () => {
  const service = { getArtist: vi.fn(async () => artist) };
  const handler = createGetArtistHandler(service as unknown as ArtistService);
  return { handler, service };
};

describe('createGetArtistHandler', () => {
  it('answers the getArtist request type', () => {
    expect(setup().handler.type).toBe('getArtist');
  });

  it('asks the service for the MBID of the payload', async () => {
    const { handler, service } = setup();

    await expect(handler.handle({ mbid: MBID })).resolves.toEqual(artist);
    expect(service.getArtist).toHaveBeenCalledExactlyOnceWith(MBID);
  });

  it.each([
    ['no payload', undefined],
    ['an empty payload', {}],
    ['text that is not an MBID', { mbid: 'nope' }],
  ])('refuses %s before reaching the service', async (_label, payload) => {
    const { handler, service } = setup();

    await expect(handler.handle(payload)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(service.getArtist).not.toHaveBeenCalled();
  });
});
