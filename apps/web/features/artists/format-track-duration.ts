/**
 * Formats a track duration for the artist table: `lengthMs` as `m:ss`
 * (`354_000` becomes `5:54`). Null (unknown length) is left to the caller,
 * which renders the translated `unknownDuration` placeholder instead.
 */
export function formatTrackDuration(lengthMs: number): string {
  const totalSeconds = Math.floor(lengthMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
