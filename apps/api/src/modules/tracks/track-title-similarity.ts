// How alike a video's title is to a Recording's title, for matching a YouTube
// video to a Recording. Pure, so the rules are tested without any I/O.

/**
 * Words that describe the upload, not the song: "Queen - Under Pressure
 * (Official Video)" is the same take as "Under Pressure". Version words
 * ("single version", "remaster") do not make another take either.
 */
const NOISE_WORDS: ReadonlySet<string> = new Set([
  '4k',
  'audio',
  'edit',
  'hd',
  'hq',
  'lyric',
  'lyrics',
  'mono',
  'music',
  'mv',
  'official',
  'radio',
  'remaster',
  'remastered',
  'single',
  'stereo',
  'topic',
  'version',
  'video',
  'visualizer',
]);

/** "(feat. X)" and "[ft. X]" name guests, which a video may or may not list. */
const FEATURING = /[([][^)\]]*\b(?:feat|ft|featuring)\b[^)\]]*[)\]]/giu;

/** A release year: remasters and reissues carry one, the song does not. */
const YEAR = /^(?:19|20)\d{2}$/;

/** Lowercase, accents and punctuation gone: the words that remain, in order. */
const wordsOf = (text: string): string[] =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(FEATURING, ' ')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');

/** The words that tell a take apart: no noise and no years. */
const titleWords = (text: string): Set<string> =>
  new Set(
    wordsOf(text).filter((word) => !NOISE_WORDS.has(word) && !YEAR.test(word)),
  );

/**
 * How alike the two titles are, from 0 to 1. The score is the smaller of the
 * two shares of words in common, so a video with extra words ("Under
 * Pressure (Karaoke)", "Live at Wembley") scores low, and so does one with
 * fewer words than the Recording.
 *
 * YouTube puts the artists' names in the title ("Queen - Under Pressure"), so
 * they are dropped from the video's words, unless the Recording's own title
 * has the same word.
 */
export function titleSimilarity(
  recordingTitle: string,
  videoTitle: string,
  artistNames: readonly string[],
): number {
  const recording = titleWords(recordingTitle);
  const artistWords = new Set(
    artistNames.flatMap((name) => [...titleWords(name)]),
  );
  const video = new Set(
    [...titleWords(videoTitle)].filter(
      (word) => !artistWords.has(word) || recording.has(word),
    ),
  );
  if (recording.size === 0 || video.size === 0) {
    return 0;
  }
  const shared = [...recording].filter((word) => video.has(word)).length;
  return Math.min(shared / recording.size, shared / video.size);
}
