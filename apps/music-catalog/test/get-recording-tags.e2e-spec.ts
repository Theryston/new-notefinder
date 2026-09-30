import type { Recording } from '@notefinder/contracts';
import { useTestServer } from './utils/create-test-server.js';
import { requestRecording } from './utils/get-recording-client.js';
import {
  addArtist,
  addRecording,
  type FixtureRecording,
  mbid,
} from './utils/musicbrainz.js';
import {
  addGenre,
  addRelease,
  addTag,
  addTrack,
  type FixtureRelease,
} from './utils/musicbrainz-relations.js';
import { useReadyCatalog } from './utils/use-ready-catalog.js';
import { useTestClient } from './utils/use-test-client.js';

type Tagging = Pick<Recording, 'genres' | 'tags' | 'tagsSource'>;

describe('getRecording: genres and tags (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  useReadyCatalog(server);

  beforeEach(async () => {
    await addGenre(server().db, { name: 'rock', mbid: mbid(501) });
    await addGenre(server().db, { name: 'pop', mbid: mbid(502) });
  });

  const taggingOf = async (): Promise<Tagging> => {
    const response = await requestRecording(client(), { mbid: mbid(100) });
    if (!response.ok) {
      throw new Error(`Unexpected failure: ${response.error.code}`);
    }
    const { genres, tags, tagsSource } = response.result;
    return { genres, tags, tagsSource };
  };

  // A Recording by two artists, on two releases (two release groups).
  const setup = async (): Promise<{
    recording: FixtureRecording;
    releases: [FixtureRelease, FixtureRelease];
    artists: [
      Awaited<ReturnType<typeof addArtist>>,
      Awaited<ReturnType<typeof addArtist>>,
    ];
  }> => {
    const db = server().db;
    const first = await addArtist(db, { name: 'First' });
    const second = await addArtist(db, { name: 'Second' });
    const recording = await addRecording(db, {
      mbid: mbid(100),
      name: 'Song',
      artists: [{ artist: first }, { artist: second }],
    });
    const releases: FixtureRelease[] = [];
    for (const n of [1, 2]) {
      const release = await addRelease(db, {
        name: `Release ${n}`,
        artistCredit: recording.artistCredit,
      });
      await addTrack(db, { release, recording });
      releases.push(release);
    }
    const [a, b] = releases;
    if (a === undefined || b === undefined) {
      throw new Error('Expected two releases');
    }
    return { recording, releases: [a, b], artists: [first, second] };
  };

  it('splits the Recording’s own tags into genres and other tags, most voted first', async () => {
    const { recording } = await setup();
    await addTag(server().db, { recording }, { name: 'live', count: 2 });
    await addTag(server().db, { recording }, { name: 'pop', count: 5 });
    await addTag(server().db, { recording }, { name: 'rock', count: 9 });
    await addTag(server().db, { recording }, { name: 'a cappella', count: 2 });

    await expect(taggingOf()).resolves.toEqual({
      genres: [
        { mbid: mbid(501), name: 'rock', count: 9 },
        { mbid: mbid(502), name: 'pop', count: 5 },
      ],
      tags: [
        { name: 'a cappella', count: 2 },
        { name: 'live', count: 2 },
      ],
      tagsSource: 'recording',
    });
  });

  it('ignores a tag whose votes do not add up to a positive number', async () => {
    const { recording } = await setup();
    await addTag(server().db, { recording }, { name: 'rock', count: 4 });
    await addTag(server().db, { recording }, { name: 'pop', count: 0 });
    await addTag(server().db, { recording }, { name: 'live', count: -1 });

    await expect(taggingOf()).resolves.toEqual({
      genres: [{ mbid: mbid(501), name: 'rock', count: 4 }],
      tags: [],
      tagsSource: 'recording',
    });
  });

  it('falls back to the release groups’ tags, added up, when the Recording has none', async () => {
    const { releases } = await setup();
    const db = server().db;
    await addTag(
      db,
      { releaseGroup: releases[0].releaseGroup },
      { name: 'rock', count: 3 },
    );
    await addTag(
      db,
      { releaseGroup: releases[1].releaseGroup },
      { name: 'rock', count: 4 },
    );
    await addTag(
      db,
      { releaseGroup: releases[1].releaseGroup },
      { name: 'live', count: 1 },
    );

    await expect(taggingOf()).resolves.toEqual({
      genres: [{ mbid: mbid(501), name: 'rock', count: 7 }],
      tags: [{ name: 'live', count: 1 }],
      tagsSource: 'release_group',
    });
  });

  it('adds up only the positive votes of the release groups', async () => {
    const { releases } = await setup();
    const db = server().db;
    await addTag(
      db,
      { releaseGroup: releases[0].releaseGroup },
      { name: 'rock', count: 5 },
    );
    await addTag(
      db,
      { releaseGroup: releases[1].releaseGroup },
      { name: 'rock', count: -2 },
    );

    await expect(taggingOf()).resolves.toMatchObject({
      genres: [{ name: 'rock', count: 5 }],
      tagsSource: 'release_group',
    });
  });

  it('falls back to the credited artists’ tags, added up, when neither the Recording nor its release groups have any', async () => {
    const { artists } = await setup();
    const db = server().db;
    await addTag(db, { artist: artists[0] }, { name: 'pop', count: 6 });
    await addTag(db, { artist: artists[1] }, { name: 'pop', count: 2 });
    await addTag(db, { artist: artists[1] }, { name: 'british', count: 3 });

    await expect(taggingOf()).resolves.toEqual({
      genres: [{ mbid: mbid(502), name: 'pop', count: 8 }],
      tags: [{ name: 'british', count: 3 }],
      tagsSource: 'artist',
    });
  });

  it('prefers the Recording’s tags over the release groups’ and the artists’', async () => {
    const { recording, releases, artists } = await setup();
    const db = server().db;
    await addTag(db, { recording }, { name: 'pop', count: 1 });
    await addTag(
      db,
      { releaseGroup: releases[0].releaseGroup },
      { name: 'rock', count: 50 },
    );
    await addTag(db, { artist: artists[0] }, { name: 'rock', count: 90 });

    await expect(taggingOf()).resolves.toEqual({
      genres: [{ mbid: mbid(502), name: 'pop', count: 1 }],
      tags: [],
      tagsSource: 'recording',
    });
  });

  it('prefers the release groups’ tags over the artists’', async () => {
    const { releases, artists } = await setup();
    const db = server().db;
    await addTag(
      db,
      { releaseGroup: releases[0].releaseGroup },
      { name: 'pop', count: 1 },
    );
    await addTag(db, { artist: artists[0] }, { name: 'rock', count: 90 });

    await expect(taggingOf()).resolves.toMatchObject({
      tagsSource: 'release_group',
      genres: [{ name: 'pop' }],
    });
  });

  it('does not mix levels: a Recording with only a non-genre tag keeps just that tag', async () => {
    const { recording, artists } = await setup();
    const db = server().db;
    await addTag(db, { recording }, { name: 'live', count: 1 });
    await addTag(db, { artist: artists[0] }, { name: 'rock', count: 90 });

    await expect(taggingOf()).resolves.toEqual({
      genres: [],
      tags: [{ name: 'live', count: 1 }],
      tagsSource: 'recording',
    });
  });

  it('answers empty genres and tags, with no source, when no level has a tag', async () => {
    await setup();

    await expect(taggingOf()).resolves.toEqual({
      genres: [],
      tags: [],
      tagsSource: null,
    });
  });
});
