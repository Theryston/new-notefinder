import { type DurationParts, durationParts } from '../duration-parts';

/**
 * Which message writes a moment of the Track as a clock, and its numbers:
 * `3:08`, with hours past an hour. next-intl formats them.
 */
export function clockMessage(seconds: number): {
  key: 'durationShort' | 'durationLong';
  values: DurationParts;
} {
  const values = durationParts(seconds * 1000);
  return { key: values.hours > 0 ? 'durationLong' : 'durationShort', values };
}

/** Writes a moment of the Track as a clock with the page's translator. */
export function formatClock(
  seconds: number,
  translate: (
    key: 'durationShort' | 'durationLong',
    values: DurationParts,
  ) => string,
): string {
  const { key, values } = clockMessage(seconds);
  return translate(key, values);
}
