import {
  type CatalogTrack,
  catalogTracksPageSchema,
} from '@notefinder/contracts';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createArtist,
  createTrack,
  createTrackExternalLink,
  createTrackRelease,
  createTrackTag,
  createTrackWork,
  linkTrackArtist,
  testMbid,
} from './utils/factories.js';

// Nested MusicBrainz sections of the artist track list over a real
// Postgres: every entry carries its releases, works, tags and external
// links, validated against the contracts schemas.
describe('Artist track details (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  it('carries releases, works, tags and links per recording', async () => {
    const artist = await createArtist(testApp.db, { name: 'Queen' });
    const track = await createTrack(testApp.db, {
      title: 'Bohemian Rhapsody',
    });
    await linkTrackArtist(testApp.db, track.id, artist.id);
    // Inserted out of read order on purpose, so the test locks the sort:
    // releases by title, tags by vote count, works and links by their
    // own titles/types.
    await createTrackRelease(testApp.db, track.id, {
      mbid: testMbid(2102),
      title: 'Greatest Hits',
      year: null,
      coverArtUrl: null,
    });
    await createTrackRelease(testApp.db, track.id, {
      mbid: testMbid(2101),
      title: 'A Night at the Opera',
      year: 1975,
      coverArtUrl: 'https://coverartarchive.org/release/2101/front-500',
    });
    await createTrackWork(testApp.db, track.id, {
      mbid: testMbid(3102),
      title: 'Zebra work',
    });
    await createTrackWork(testApp.db, track.id, {
      mbid: testMbid(3101),
      title: 'Bohemian Rhapsody work',
    });
    await createTrackTag(testApp.db, track.id, {
      name: 'classic',
      count: 5,
    });
    await createTrackTag(testApp.db, track.id, {
      name: 'rock',
      count: 10,
    });
    await createTrackExternalLink(testApp.db, track.id, {
      url: 'https://open.spotify.com/track/123',
      linkType: 'streaming music',
    });
    await createTrackExternalLink(testApp.db, track.id, {
      url: 'https://musicbrainz.org/recording/3101',
      linkType: 'musicbrainz',
    });

    const response = await testApp.http
      .get(`/v1/artists/${artist.id}/tracks`)
      .expect(200);

    const page = catalogTracksPageSchema.parse(response.body);
    expect(page).toEqual(response.body);
    expect(page.items).toHaveLength(1);
    const item = page.items[0] as CatalogTrack;
    expect(item.releases).toEqual([
      {
        mbid: testMbid(2101),
        title: 'A Night at the Opera',
        year: 1975,
        coverArtUrl: 'https://coverartarchive.org/release/2101/front-500',
      },
      {
        mbid: testMbid(2102),
        title: 'Greatest Hits',
        year: null,
        coverArtUrl: null,
      },
    ]);
    expect(item.works).toEqual([
      { mbid: testMbid(3101), title: 'Bohemian Rhapsody work' },
      { mbid: testMbid(3102), title: 'Zebra work' },
    ]);
    expect(item.tags).toEqual([
      { name: 'rock', count: 10 },
      { name: 'classic', count: 5 },
    ]);
    expect(item.externalLinks).toEqual([
      {
        url: 'https://musicbrainz.org/recording/3101',
        linkType: 'musicbrainz',
      },
      {
        url: 'https://open.spotify.com/track/123',
        linkType: 'streaming music',
      },
    ]);
  });

  it('answers empty sections when the catalog has none', async () => {
    const artist = await createArtist(testApp.db);
    const track = await createTrack(testApp.db);
    await linkTrackArtist(testApp.db, track.id, artist.id);

    const response = await testApp.http
      .get(`/v1/artists/${artist.id}/tracks`)
      .expect(200);

    const page = catalogTracksPageSchema.parse(response.body);
    const item = page.items[0] as CatalogTrack;
    expect(item.releases).toEqual([]);
    expect(item.works).toEqual([]);
    expect(item.tags).toEqual([]);
    expect(item.externalLinks).toEqual([]);
  });

  it('keeps details isolated per track across pages', async () => {
    const artist = await createArtist(testApp.db);
    const first = await createTrack(testApp.db, { title: 'First' });
    const second = await createTrack(testApp.db, { title: 'Second' });
    await linkTrackArtist(testApp.db, first.id, artist.id);
    await linkTrackArtist(testApp.db, second.id, artist.id);
    await createTrackRelease(testApp.db, first.id, {
      mbid: testMbid(2201),
      title: 'First Release',
      year: 1980,
      coverArtUrl: null,
    });

    const response = await testApp.http
      .get(`/v1/artists/${artist.id}/tracks`)
      .expect(200);

    const page = catalogTracksPageSchema.parse(response.body);
    const byId = new Map(page.items.map((entry) => [entry.id, entry]));
    expect(byId.get(first.id)?.releases).toHaveLength(1);
    expect(byId.get(second.id)?.releases).toEqual([]);
  });
});
