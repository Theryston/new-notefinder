import { setTranspose, transposeStore } from '../stores/transpose-store';
import { readTranspose, writeTranspose } from './transpose-storage';

type RememberStorage = Parameters<typeof readTranspose>[0];

/**
 * Applies the transposition remembered for a Track and remembers every change
 * after that. Returns the way to stop, which also puts the page back at the
 * original key for the next Track.
 */
export function rememberTranspose(
  storage: RememberStorage,
  trackId: string,
): () => void {
  setTranspose(readTranspose(storage, trackId));
  const unsubscribe = transposeStore.subscribe((state) =>
    writeTranspose(storage, trackId, state.semitones),
  );
  return () => {
    unsubscribe();
    setTranspose(0);
  };
}
