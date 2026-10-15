import { clampTranspose } from './transpose';

type TransposeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const storageKey = (trackId: string) => `notefinder:transpose:${trackId}`;

/**
 * `localStorage`, or `undefined` where it can't be used (the server, private
 * mode, blocked site data): the transposition is then simply not remembered.
 */
export function transposeStorage(): TransposeStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** The transposition remembered for a Track on this device; 0 when none. */
export function readTranspose(
  storage: TransposeStorage | undefined,
  trackId: string,
): number {
  try {
    const stored = storage?.getItem(storageKey(trackId));
    return stored == null ? 0 : clampTranspose(Number(stored));
  } catch {
    return 0;
  }
}

/** Remembers a Track's transposition; back at the original key forgets it. */
export function writeTranspose(
  storage: TransposeStorage | undefined,
  trackId: string,
  semitones: number,
): void {
  try {
    if (semitones === 0) {
      storage?.removeItem(storageKey(trackId));
    } else {
      storage?.setItem(storageKey(trackId), String(semitones));
    }
  } catch {
    // Storage is a convenience: a full or blocked one only loses the memory.
  }
}
