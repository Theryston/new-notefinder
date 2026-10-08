import {
  creditKey,
  printedCredit,
  TINY_RECORDING_COUNT,
  tinyArtistCreditMbid,
  tinySeed,
  tinySeedCredits,
  tinySeedTagNames,
} from './tiny-seed.js';

const mbidsOf = (rows: readonly { mbid: string }[]) =>
  new Set(rows.map((row) => row.mbid));

const tracks = tinySeed.releases.flatMap((release) =>
  release.media.flatMap((medium) => medium.tracks),
);

const credits = [
  ...tinySeed.recordings.map((recording) => recording.artistCredit),
  ...tinySeed.releaseGroups.map((group) => group.artistCredit),
  ...tinySeed.releases.map((release) => release.artistCredit),
];

describe('tinySeed', () => {
  it('seeds about a hundred real Recordings of several artists', () => {
    expect(TINY_RECORDING_COUNT).toBe(tinySeed.recordings.length);
    expect(TINY_RECORDING_COUNT).toBeGreaterThanOrEqual(100);
    expect(tinySeed.artists.length).toBeGreaterThanOrEqual(5);
    expect(tinySeed.releases.length).toBeGreaterThanOrEqual(10);
  });

  it('gives every row of a kind a unique MBID', () => {
    for (const rows of [
      tinySeed.areas,
      tinySeed.artists,
      tinySeed.genres,
      tinySeed.recordings,
      tinySeed.releaseGroups,
      tinySeed.releases,
      tinySeed.releases.flatMap((release) => release.media),
      tracks,
    ]) {
      expect(mbidsOf(rows).size).toBe(rows.length);
    }
  });

  it('puts every Recording on a track, and every track on a seeded Recording', () => {
    const onTracks = new Set(tracks.map((track) => track.recording));

    expect(onTracks).toEqual(mbidsOf(tinySeed.recordings));
  });

  it('credits only seeded artists', () => {
    const artists = mbidsOf(tinySeed.artists);

    for (const entry of credits.flat()) {
      expect(artists.has(entry.artist)).toBe(true);
    }
  });

  it('refers only to seeded release groups, statuses, types and countries', () => {
    const groups = mbidsOf(tinySeed.releaseGroups);
    const statuses = new Set(tinySeed.releaseStatuses.map((row) => row.name));
    const types = new Set(
      tinySeed.releaseGroupPrimaryTypes.map((row) => row.name),
    );
    const countries = new Set(tinySeed.areas.map((area) => area.code));

    for (const release of tinySeed.releases) {
      expect(groups.has(release.releaseGroup)).toBe(true);
      expect(release.status === null || statuses.has(release.status)).toBe(
        true,
      );
      for (const event of release.events) {
        expect(event.country === null || countries.has(event.country)).toBe(
          true,
        );
      }
    }
    for (const group of tinySeed.releaseGroups) {
      expect(group.primaryType === null || types.has(group.primaryType)).toBe(
        true,
      );
    }
  });

  it('lists as genres only names some release group is tagged with', () => {
    const tags = new Set(tinySeedTagNames(tinySeed));

    for (const genre of tinySeed.genres) {
      expect(tags.has(genre.name)).toBe(true);
    }
  });

  it('covers a shared Recording, a multi-artist credit and a named disc', () => {
    const appearances = new Map<string, number>();
    for (const track of tracks) {
      appearances.set(
        track.recording,
        (appearances.get(track.recording) ?? 0) + 1,
      );
    }

    expect([...appearances.values()].some((count) => count > 1)).toBe(true);
    expect(
      tinySeed.recordings.some(
        (recording) => recording.artistCredit.length > 1,
      ),
    ).toBe(true);
    expect(
      tinySeed.releases.some((release) =>
        release.media.some((medium) => medium.position > 1 && medium.title),
      ),
    ).toBe(true);
  });
});

describe('printedCredit', () => {
  it('joins every credited name with its join phrase', () => {
    expect(
      printedCredit([
        { artist: tinyArtistCreditMbid(1), name: 'Queen', joinPhrase: ' & ' },
        {
          artist: tinyArtistCreditMbid(2),
          name: 'David Bowie',
          joinPhrase: '',
        },
      ]),
    ).toBe('Queen & David Bowie');
  });
});

describe('tinySeedCredits', () => {
  it('lists every credit once, in first-use order, on a fixed MBID series', () => {
    const rows = tinySeedCredits(tinySeed);

    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(rows.map((row) => row.mbid)).toEqual(
      rows.map((_, index) => tinyArtistCreditMbid(index + 1)),
    );
    expect(new Set(rows.map((row) => row.key))).toEqual(
      new Set(credits.map(creditKey)),
    );
    const first = tinySeed.recordings[0]?.artistCredit ?? [];
    expect(rows[0]).toEqual({
      key: creditKey(first),
      mbid: tinyArtistCreditMbid(1),
      name: printedCredit(first),
      entries: first,
    });
  });
});

describe('tinyArtistCreditMbid', () => {
  it('ends in the padded index', () => {
    expect(tinyArtistCreditMbid(7)).toBe(
      '44444444-4444-4444-8444-000000000007',
    );
  });
});

describe('tinySeedTagNames', () => {
  it('lists each release group tag once, sorted', () => {
    const names = tinySeedTagNames(tinySeed);

    expect(names).toEqual([...new Set(names)].sort());
    expect(names).toEqual(
      expect.arrayContaining(
        tinySeed.releaseGroups.flatMap((group) =>
          group.tags.map((tag) => tag.name),
        ),
      ),
    );
  });
});
