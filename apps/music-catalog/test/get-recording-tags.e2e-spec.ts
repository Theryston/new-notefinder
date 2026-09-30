import type { Recording } from '@notefinder/contracts';
import { useTestServer } from './utils/create-test-server.js';
import { requestRecording } from './utils/get-recording-client.js';
import { addArtist, addRecording, mbid } from './utils/musicbrainz.js';
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

type Pair = 0 | 1;

const pick = <T>(items: readonly T[], which: Pair): T => {
  const item = items[which];
  if (item === undefined) {
    throw new Error(`Expected an item at ${which}`);
  }
  return item;
};

// A Recording by two artists, on two releases (so two release groups), with
// a way to vote for a tag at each level. The genres are `rock` and `pop`.
type Scene = {
  tagRecording: (name: string, count: number) => Promise<void>;
  tagReleaseGroup: (which: Pair, name: string, count: number) => Promise<void>;
  tagArtist: (which: Pair, name: string, count: number) => Promise<void>;
};

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

  const setup = async (): Promise<Scene> => {
    const db = server().db;
    const artists = [
      await addArtist(db, { name: 'First' }),
      await addArtist(db, { name: 'Second' }),
    ];
    const recording = await addRecording(db, {
      mbid: mbid(100),
      name: 'Song',
      artists: artists.map((artist) => ({ artist })),
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
    return {
      tagRecording: (name, count) => addTag(db, { recording }, { name, count }),
      tagReleaseGroup: (which, name, count) =>
        addTag(
          db,
          { releaseGroup: pick(releases, which).releaseGroup },
          { name, count },
        ),
      tagArtist: (which, name, count) =>
        addTag(db, { artist: pick(artists, which) }, { name, count }),
    };
  };

  it('splits the Recording’s own tags into genres and other tags, most voted first', async () => {
    const scene = await setup();
    await scene.tagRecording('live', 2);
    await scene.tagRecording('pop', 5);
    await scene.tagRecording('rock', 9);
    await scene.tagRecording('a cappella', 2);

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
    const scene = await setup();
    await scene.tagRecording('rock', 4);
    await scene.tagRecording('pop', 0);
    await scene.tagRecording('live', -1);

    await expect(taggingOf()).resolves.toEqual({
      genres: [{ mbid: mbid(501), name: 'rock', count: 4 }],
      tags: [],
      tagsSource: 'recording',
    });
  });

  it('falls back to the release groups’ genres, added up, when the Recording has no tag', async () => {
    const scene = await setup();
    await scene.tagReleaseGroup(0, 'rock', 3);
    await scene.tagReleaseGroup(1, 'rock', 4);
    await scene.tagReleaseGroup(1, 'live', 1);

    await expect(taggingOf()).resolves.toEqual({
      genres: [{ mbid: mbid(501), name: 'rock', count: 7 }],
      tags: [{ name: 'live', count: 1 }],
      tagsSource: 'release_group',
    });
  });

  it('adds up only the positive votes of the release groups', async () => {
    const scene = await setup();
    await scene.tagReleaseGroup(0, 'rock', 5);
    await scene.tagReleaseGroup(1, 'rock', -2);

    await expect(taggingOf()).resolves.toMatchObject({
      genres: [{ name: 'rock', count: 5 }],
      tagsSource: 'release_group',
    });
  });

  it('falls back to the credited artists’ genres, added up, when neither the Recording nor its release groups have a tag', async () => {
    const scene = await setup();
    await scene.tagArtist(0, 'pop', 6);
    await scene.tagArtist(1, 'pop', 2);
    await scene.tagArtist(1, 'british', 3);

    await expect(taggingOf()).resolves.toEqual({
      genres: [{ mbid: mbid(502), name: 'pop', count: 8 }],
      tags: [{ name: 'british', count: 3 }],
      tagsSource: 'artist',
    });
  });

  it('prefers the Recording’s genres over the release groups’ and the artists’', async () => {
    const scene = await setup();
    await scene.tagRecording('pop', 1);
    await scene.tagReleaseGroup(0, 'rock', 50);
    await scene.tagArtist(0, 'rock', 90);

    await expect(taggingOf()).resolves.toEqual({
      genres: [{ mbid: mbid(502), name: 'pop', count: 1 }],
      tags: [],
      tagsSource: 'recording',
    });
  });

  it('prefers the release groups’ genres over the artists’', async () => {
    const scene = await setup();
    await scene.tagReleaseGroup(0, 'pop', 1);
    await scene.tagArtist(0, 'rock', 90);

    await expect(taggingOf()).resolves.toMatchObject({
      tagsSource: 'release_group',
      genres: [{ name: 'pop' }],
    });
  });

  it('falls back to the release groups’ genres when the Recording has only a tag that is not a genre, and gives that level’s tags instead of its own', async () => {
    const scene = await setup();
    await scene.tagRecording('live', 3);
    await scene.tagReleaseGroup(0, 'rock', 4);
    await scene.tagReleaseGroup(0, 'british', 1);

    await expect(taggingOf()).resolves.toEqual({
      genres: [{ mbid: mbid(501), name: 'rock', count: 4 }],
      tags: [{ name: 'british', count: 1 }],
      tagsSource: 'release_group',
    });
  });

  it('falls back to the artists’ genres when neither the Recording nor its release groups have a genre', async () => {
    const scene = await setup();
    await scene.tagRecording('live', 3);
    await scene.tagReleaseGroup(0, 'british', 2);
    await scene.tagArtist(0, 'pop', 6);
    await scene.tagArtist(1, 'duo', 1);

    await expect(taggingOf()).resolves.toEqual({
      genres: [{ mbid: mbid(502), name: 'pop', count: 6 }],
      tags: [{ name: 'duo', count: 1 }],
      tagsSource: 'artist',
    });
  });

  it('keeps the tags of the first level that has one when no level has a genre', async () => {
    const scene = await setup();
    await scene.tagRecording('live', 3);
    await scene.tagReleaseGroup(0, 'british', 2);
    await scene.tagArtist(0, 'duo', 1);

    await expect(taggingOf()).resolves.toEqual({
      genres: [],
      tags: [{ name: 'live', count: 3 }],
      tagsSource: 'recording',
    });
  });

  it('keeps the release groups’ tags when only they have one and none is a genre', async () => {
    const scene = await setup();
    await scene.tagReleaseGroup(0, 'british', 2);
    await scene.tagArtist(0, 'duo', 1);

    await expect(taggingOf()).resolves.toEqual({
      genres: [],
      tags: [{ name: 'british', count: 2 }],
      tagsSource: 'release_group',
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
