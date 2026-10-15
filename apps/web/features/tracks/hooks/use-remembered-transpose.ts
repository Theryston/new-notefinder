'use client';

import { useEffect } from 'react';

import { rememberTranspose } from '../transpose/remember-transpose';
import { transposeStorage } from '../transpose/transpose-storage';

/**
 * Keeps the Track's transposition on this device. It is read in an effect,
 * after the first render, so the server's markup and the browser's first
 * render agree.
 */
export function useRememberedTranspose(trackId: string) {
  useEffect(() => rememberTranspose(transposeStorage(), trackId), [trackId]);
}
