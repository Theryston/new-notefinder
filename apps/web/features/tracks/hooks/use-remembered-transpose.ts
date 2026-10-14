'use client';

import { useEffect } from 'react';

import { setTranspose, transposeStore } from '../stores/transpose-store';
import {
  readTranspose,
  transposeStorage,
  writeTranspose,
} from '../transpose/transpose-storage';

/**
 * Keeps the Track's transposition on this device: the remembered one is
 * applied when the page opens, and every change after that is remembered. It
 * is read in an effect, after the first render, so the server's markup and the
 * browser's first render agree.
 */
export function useRememberedTranspose(trackId: string) {
  useEffect(() => {
    const storage = transposeStorage();
    setTranspose(readTranspose(storage, trackId));
    const unsubscribe = transposeStore.subscribe((state) =>
      writeTranspose(storage, trackId, state.semitones),
    );
    return () => {
      unsubscribe();
      setTranspose(0);
    };
  }, [trackId]);
}
