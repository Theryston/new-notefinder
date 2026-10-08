import {
  artistsMatch,
  chooseSearchMatch,
  durationToleranceSeconds,
  isDurationMatch,
  isValidCandidate,
  type RecordingTarget,
  recordingTargetOf,
  searchQueryOf,
  type VideoCandidate,
} from './track-video-matching.js';

// "Bohemian Rhapsody" by Queen, 5:54: the length the cases below are built on.
const target: RecordingTarget = {
  title: 'Bohemian Rhapsody',
  lengthMs: 354_000,
  artistNames: ['Queen'],
};

const candidate = (
  overrides: Partial<VideoCandidate> = {},
): VideoCandidate => ({
  videoId: 'aaaaaaaaaaa',
  title: 'Queen - Bohemian Rhapsody (Official Video)',
  artists: ['Queen'],
  durationSeconds: 354,
  kind: 'song',
  ...overrides,
});

describe('durationToleranceSeconds', () => {
  it('is 3 seconds for a short Recording', () => {
    expect(durationToleranceSeconds(60_000)).toBe(3);
  });

  it('is 3% of the length for a long one', () => {
    expect(durationToleranceSeconds(354_000)).toBeCloseTo(10.62);
  });
});

describe('isDurationMatch', () => {
  it('accepts a video within the tolerance either way', () => {
    expect(isDurationMatch(target, candidate({ durationSeconds: 364 }))).toBe(
      true,
    );
    expect(isDurationMatch(target, candidate({ durationSeconds: 344 }))).toBe(
      true,
    );
  });

  it('refuses a video just outside the tolerance', () => {
    expect(isDurationMatch(target, candidate({ durationSeconds: 366 }))).toBe(
      false,
    );
  });

  it('refuses a video with no length against a Recording that has one', () => {
    expect(isDurationMatch(target, candidate({ durationSeconds: null }))).toBe(
      false,
    );
  });

  it('skips the check when the Recording has no length', () => {
    const unknown = { ...target, lengthMs: null };

    expect(isDurationMatch(unknown, candidate({ durationSeconds: 900 }))).toBe(
      true,
    );
    expect(isDurationMatch(unknown, candidate({ durationSeconds: null }))).toBe(
      true,
    );
  });
});

describe('artistsMatch', () => {
  it('matches a channel name that carries the artist name', () => {
    expect(artistsMatch(['Queen'], ['QueenVEVO'])).toBe(true);
  });

  it('matches the same name written differently', () => {
    expect(artistsMatch(['Beyoncé'], ['beyonce'])).toBe(true);
  });

  it('refuses a video by another artist', () => {
    expect(artistsMatch(['Queen'], ['Adele'])).toBe(false);
  });

  it('does not match a very short name inside a longer one', () => {
    expect(artistsMatch(['A'], ['Amy Winehouse'])).toBe(false);
  });

  it('refuses a video that lists no artist when the Recording has some', () => {
    expect(artistsMatch(['Queen'], [])).toBe(false);
  });

  it('passes when the Recording credits no artist', () => {
    expect(artistsMatch([], [])).toBe(true);
  });
});

describe('isValidCandidate', () => {
  it('accepts the Recording itself', () => {
    expect(isValidCandidate(target, candidate())).toBe(true);
  });

  it('refuses a live version of the same song', () => {
    expect(
      isValidCandidate(
        target,
        candidate({ title: 'Queen - Bohemian Rhapsody (Live at Wembley)' }),
      ),
    ).toBe(false);
  });

  it('refuses a video of the right title and length by another artist', () => {
    expect(
      isValidCandidate(
        target,
        candidate({ artists: ['Cover Band'], title: 'Bohemian Rhapsody' }),
      ),
    ).toBe(false);
  });
});

describe('chooseSearchMatch', () => {
  it('returns undefined when no candidate is valid', () => {
    expect(
      chooseSearchMatch(target, [
        candidate({ durationSeconds: 500 }),
        candidate({ videoId: 'bbbbbbbbbbb', artists: ['Adele'] }),
      ]),
    ).toBeUndefined();
  });

  it('returns undefined for no candidates at all', () => {
    expect(chooseSearchMatch(target, [])).toBeUndefined();
  });

  it('prefers a song over a music video when both match', () => {
    const video = candidate({
      videoId: 'videoxxxxxx',
      kind: 'video',
      title: 'Queen - Bohemian Rhapsody (Official Music Video)',
    });
    const song = candidate({
      videoId: 'songxxxxxxx',
      kind: 'song',
      title: 'Bohemian Rhapsody',
    });

    expect(chooseSearchMatch(target, [video, song])?.videoId).toBe(
      'songxxxxxxx',
    );
  });

  it('prefers the closer title among songs', () => {
    // Five words: four in common is 0.8 (still valid), five is 1.
    const longTitle = { ...target, title: 'One Two Three Four Five' };
    const shorter = candidate({
      videoId: 'shorterxxxxx',
      title: 'Queen - One Two Three Four',
    });
    const exact = candidate({
      videoId: 'exactxxxxxx',
      title: 'Queen - One Two Three Four Five',
    });

    expect(chooseSearchMatch(longTitle, [shorter, exact])?.videoId).toBe(
      'exactxxxxxx',
    );
  });

  it('prefers the closer length when the titles are equally close', () => {
    const far = candidate({ videoId: 'farxxxxxxxx', durationSeconds: 362 });
    const near = candidate({ videoId: 'nearxxxxxxx', durationSeconds: 355 });

    expect(chooseSearchMatch(target, [far, near])?.videoId).toBe('nearxxxxxxx');
  });

  it('breaks a full tie by the smallest video ID', () => {
    const later = candidate({ videoId: 'zzzzzzzzzzz' });
    const earlier = candidate({ videoId: 'aaaaaaaaaab' });

    expect(chooseSearchMatch(target, [later, earlier])?.videoId).toBe(
      'aaaaaaaaaab',
    );
  });

  it('keeps the candidate object it was given', () => {
    const withArtwork = { ...candidate(), artworkUrl: 'https://img.test/a' };

    expect(chooseSearchMatch(target, [withArtwork])).toBe(withArtwork);
  });
});

describe('recordingTargetOf', () => {
  it('keeps the title, length and credited artists of the Track', () => {
    expect(
      recordingTargetOf({
        title: 'Bohemian Rhapsody',
        lengthMs: 354_000,
        artistNames: ['Queen'],
      }),
    ).toEqual(target);
  });
});

describe('searchQueryOf', () => {
  it('is the artists then the title', () => {
    expect(
      searchQueryOf({ ...target, artistNames: ['Queen', 'David Bowie'] }),
    ).toBe('Queen David Bowie Bohemian Rhapsody');
  });
});
