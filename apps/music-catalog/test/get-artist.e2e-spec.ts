import { useTestServer } from './utils/create-test-server.js';
import { requestArtist } from './utils/get-artist-client.js';
import { addArtist, addArtistRedirect, mbid } from './utils/musicbrainz.js';
import { addGenre, addTag } from './utils/musicbrainz-relations.js';
import { useReadyCatalog } from './utils/use-ready-catalog.js';
import { useTestClient } from './utils/use-test-client.js';

describe('getArtist: the artist (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  useReadyCatalog(server);

  it('returns the artist with its genres, most voted first, and only the genres', async () => {
    const db = server().db;
    const queen = await addArtist(db, { name: 'Queen', mbid: mbid(1) });
    await addGenre(db, { name: 'rock', mbid: mbid(500) });
    await addGenre(db, { name: 'pop', mbid: mbid(501) });
    await addTag(db, { artist: queen }, { name: 'rock', count: 5 });
    await addTag(db, { artist: queen }, { name: 'pop', count: 9 });
    await addTag(db, { artist: queen }, { name: 'seen live', count: 12 });

    const response = await requestArtist(client(), { mbid: mbid(1) });

    expect(response).toEqual({
      id: expect.any(String),
      ok: true,
      result: {
        mbid: mbid(1),
        name: 'Queen',
        genres: [
          { mbid: mbid(501), name: 'pop', count: 9 },
          { mbid: mbid(500), name: 'rock', count: 5 },
        ],
      },
    });
  });

  it('answers an artist with no genre as an empty list', async () => {
    await addArtist(server().db, { name: 'Nobody', mbid: mbid(1) });

    const response = await requestArtist(client(), { mbid: mbid(1) });

    expect(response).toEqual({
      id: expect.any(String),
      ok: true,
      result: { mbid: mbid(1), name: 'Nobody', genres: [] },
    });
  });

  it('answers ARTIST_NOT_FOUND for an MBID it does not know', async () => {
    const response = await requestArtist(client(), { mbid: mbid(404) });

    expect(response).toEqual({
      id: expect.any(String),
      ok: false,
      error: {
        code: 'ARTIST_NOT_FOUND',
        message: `No artist has the MBID ${mbid(404)}`,
      },
    });
  });

  it('answers ARTIST_MOVED with the new MBID for an artist MusicBrainz merged', async () => {
    const queen = await addArtist(server().db, {
      name: 'Queen',
      mbid: mbid(1),
    });
    await addArtistRedirect(server().db, mbid(2), queen);

    const response = await requestArtist(client(), { mbid: mbid(2) });

    expect(response).toMatchObject({
      ok: false,
      error: { code: 'ARTIST_MOVED', newMbid: mbid(1) },
    });
  });

  it.each([
    ['no payload', undefined],
    ['an MBID that is not a UUID', { mbid: 'queen' }],
  ])('answers VALIDATION_FAILED for %s', async (_label, payload) => {
    const response = await requestArtist(client(), payload);

    expect(response).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
  });
});
