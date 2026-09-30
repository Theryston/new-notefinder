import { useTestServer } from './utils/create-test-server.js';
import { addArtist, addRecording, mbid } from './utils/musicbrainz.js';
import {
  addArtistAlias,
  addGenre,
  addRelease,
  addTag,
  addTrack,
  addWork,
} from './utils/musicbrainz-relations.js';
import { requestSearch } from './utils/search-client.js';
import { indexCatalog, useEmptySearchIndex } from './utils/test-worker.js';
import { useTestClient } from './utils/use-test-client.js';

const YESTERDAY = mbid(100);
const HEY_JUDE = mbid(101);
const WONDERWALL = mbid(102);

describe('search: finding Recordings (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  useEmptySearchIndex();

  // Three Recordings by two artists, on releases of their own, searchable
  // through every field the index looks at.
  const songbook = async () => {
    const db = server().db;
    const beatles = await addArtist(db, {
      name: 'The Beatles',
      sortName: 'Beatles, The',
      mbid: mbid(1),
    });
    await addArtistAlias(db, beatles, { name: 'Fab Four' });
    const oasis = await addArtist(db, { name: 'Oasis', mbid: mbid(2) });
    await addGenre(db, { name: 'rock', mbid: mbid(900) });

    const yesterday = await addRecording(db, {
      mbid: YESTERDAY,
      name: 'Yesterday',
      artists: [{ artist: beatles }],
    });
    const heyJude = await addRecording(db, {
      mbid: HEY_JUDE,
      name: 'Hey Jude',
      artists: [{ artist: beatles }],
    });
    const wonderwall = await addRecording(db, {
      mbid: WONDERWALL,
      name: 'Wonderwall',
      artists: [{ artist: oasis }],
    });

    const help = await addRelease(db, {
      name: 'Help!',
      artistCredit: yesterday.artistCredit,
      events: [{ country: 'GB', year: 1965, month: 8, day: 6 }],
    });
    await addTrack(db, { release: help, recording: yesterday });
    const morningGlory = await addRelease(db, {
      name: "(What's the Story) Morning Glory?",
      artistCredit: wonderwall.artistCredit,
      events: [{ country: 'GB', year: 1995 }],
    });
    await addTrack(db, { release: morningGlory, recording: wonderwall });
    await addWork(db, yesterday, { name: 'Scrambled Eggs' });
    await addTag(db, { recording: heyJude }, { name: 'rock', count: 4 });
    await indexCatalog(server());
  };

  const mbidsFor = async (payload: unknown): Promise<string[]> => {
    const response = await requestSearch(client(), payload);
    if (!response.ok) {
      throw new Error(`search failed: ${response.error.code}`);
    }
    return response.result.results.map((result) => result.mbid);
  };

  it.each([
    ['its title', 'yesterday', [YESTERDAY]],
    ['its title in other letters', 'YESTERDAY', [YESTERDAY]],
    ['the printed artist credit', 'oasis', [WONDERWALL]],
    ['an alias of the artist', 'fab four', [YESTERDAY, HEY_JUDE]],
    ['the sort name of the artist', 'beatles, the', [YESTERDAY, HEY_JUDE]],
    ['the title of its release', 'morning glory', [WONDERWALL]],
    ['the title of its Work', 'scrambled eggs', [YESTERDAY]],
    ['its genre', 'rock', [HEY_JUDE]],
    ['the title and the artist', 'wonderwall oasis', [WONDERWALL]],
  ])('finds a Recording by %s', async (_label, query, expected) => {
    await songbook();

    const found = await mbidsFor({ query });

    expect([...found].sort()).toEqual([...expected].sort());
  });

  it('finds a Recording by the disambiguation it is told apart with', async () => {
    const db = server().db;
    const artist = await addArtist(db, { name: 'Band' });
    await addRecording(db, {
      mbid: mbid(200),
      name: 'Song',
      artists: [{ artist }],
    });
    await addRecording(db, {
      mbid: mbid(201),
      name: 'Song',
      artists: [{ artist }],
      disambiguation: 'acoustic demo',
    });
    await indexCatalog(server());

    const found = await mbidsFor({ query: 'song acoustic demo' });

    expect(found[0]).toBe(mbid(201));
  });

  it('finds a Recording by a genre it takes from its release group or its artist, like getRecording does', async () => {
    const db = server().db;
    await addGenre(db, { name: 'folk', mbid: mbid(901) });
    await addGenre(db, { name: 'jazz', mbid: mbid(902) });
    const band = await addArtist(db, { name: 'Band' });
    const onAlbum = await addRecording(db, {
      mbid: mbid(300),
      name: 'Alpha',
      artists: [{ artist: band }],
    });
    const album = await addRelease(db, {
      name: 'Album',
      artistCredit: onAlbum.artistCredit,
    });
    await addTrack(db, { release: album, recording: onAlbum });
    await addTag(
      db,
      { releaseGroup: album.releaseGroup },
      { name: 'folk', count: 3 },
    );
    const solo = await addArtist(db, { name: 'Solo' });
    await addRecording(db, {
      mbid: mbid(301),
      name: 'Beta',
      artists: [{ artist: solo }],
    });
    await addTag(db, { artist: solo }, { name: 'jazz', count: 2 });
    await indexCatalog(server());

    expect(await mbidsFor({ query: 'folk' })).toEqual([mbid(300)]);
    expect(await mbidsFor({ query: 'jazz' })).toEqual([mbid(301)]);
  });

  it('finds a Recording whose query has a typo', async () => {
    await songbook();

    const found = await mbidsFor({ query: 'yestrday' });

    expect(found[0]).toBe(YESTERDAY);
  });

  it.each([
    ['a word cut short', 'wonderw', WONDERWALL],
    ['the last word cut short', 'hey ju', HEY_JUDE],
    ['an artist cut short', 'the beat', YESTERDAY],
  ])('finds a Recording typed as %s', async (_label, query, expected) => {
    await songbook();

    const found = await mbidsFor({ query });

    expect(found).toContain(expected);
  });

  it('answers no results when nothing matches', async () => {
    await songbook();

    const response = await requestSearch(client(), { query: 'zzzzqqqq' });

    expect(response).toMatchObject({ ok: true, result: { results: [] } });
  });
});
