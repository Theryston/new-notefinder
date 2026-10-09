import { primaryReleaseOf } from './track-primary-release.js';

const release = (mbid: string, year: number | null, title = 'Album') => ({
  mbid,
  title,
  year,
});

describe('primaryReleaseOf', () => {
  it('is undefined without releases', () => {
    expect(primaryReleaseOf([])).toBeUndefined();
  });

  it('picks the earliest year', () => {
    const picked = primaryReleaseOf([
      release('b', 1990),
      release('a', 1975),
      release('c', 2001),
    ]);

    expect(picked?.mbid).toBe('a');
  });

  it('lists an undated release after the dated ones', () => {
    const picked = primaryReleaseOf([release('a', null), release('b', 2001)]);

    expect(picked?.mbid).toBe('b');
  });

  it('breaks a tie in year by title, then by MBID', () => {
    expect(
      primaryReleaseOf([
        release('z', 1975, 'Beta'),
        release('y', 1975, 'Alpha'),
      ])?.mbid,
    ).toBe('y');
    expect(
      primaryReleaseOf([release('z', 1975, 'Same'), release('y', 1975, 'Same')])
        ?.mbid,
    ).toBe('y');
  });

  it('does not reorder the releases it is given', () => {
    const releases = [release('b', 1990), release('a', 1975)];

    primaryReleaseOf(releases);

    expect(releases.map((item) => item.mbid)).toEqual(['b', 'a']);
  });
});
