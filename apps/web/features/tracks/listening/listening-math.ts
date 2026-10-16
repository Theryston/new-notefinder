import type { TrackNote } from '@notefinder/contracts';

export function nextNotesTarget(notes: readonly TrackNote[], time: number) {
  if (notes.some((note) => note.start <= time && note.end > time)) return null;
  const next = notes.find((note) => note.start > time);
  return next && next.start - time >= 10 ? Math.max(0, next.start - 1) : null;
}

export type LoopRange = { start: number; end: number };

export function loopRange(
  start: number,
  end: number,
  duration: number,
): LoopRange | null {
  if (duration <= 0) return null;
  const minimum = Math.min(0.1, duration);
  const a = Math.max(0, Math.min(start, duration - minimum));
  return { start: a, end: Math.max(a + minimum, Math.min(end, duration)) };
}

export function moveLoopHandle(
  range: LoopRange,
  handle: 'start' | 'end',
  time: number,
  duration: number,
): LoopRange | null {
  const normalized = loopRange(range.start, range.end, duration);
  if (!normalized) return null;
  const minimum = Math.min(0.1, duration);
  if (handle === 'start')
    return loopRange(
      Math.min(time, normalized.end - minimum),
      normalized.end,
      duration,
    );
  return loopRange(
    normalized.start,
    Math.max(time, normalized.start + minimum),
    duration,
  );
}
