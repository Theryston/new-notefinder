/** A length split into the numbers the duration messages format. */
export type DurationParts = { hours: number; minutes: number; seconds: number };

/**
 * A length in milliseconds as whole hours, minutes and seconds, rounded to the
 * nearest second. The text is the messages' to write
 * (`tracks.practice.durationShort` and `durationLong`), so next-intl formats
 * the numbers and nothing is padded by hand.
 */
export function durationParts(ms: number): DurationParts {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}
