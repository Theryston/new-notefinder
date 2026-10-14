const KEY_PREFIX = 'track-transpose:';

/** Reads the Track's chosen transpose from this device. */
export function loadTrackTranspose(trackId: string): number {
  if (typeof window === 'undefined') return 0;
  const stored = window.localStorage.getItem(`${KEY_PREFIX}${trackId}`);
  if (stored === null) return 0;
  const semitones = Number(stored);
  return Number.isInteger(semitones) ? semitones : 0;
}

/** Remembers the transpose on this device for this Track. */
export function saveTrackTranspose(trackId: string, semitones: number): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(`${KEY_PREFIX}${trackId}`, String(semitones));
  }
}
