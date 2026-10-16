'use client';

import { useEffect, useRef } from 'react';

import {
  createPreferenceSync,
  type PreferenceSync,
} from '../preference-sync-engine';

/**
 * Keeps the difficulty, octave mode, guide melody and count-in on the
 * account while signed in, on the device otherwise. Signing in adopts the
 * account values (which also refreshes the device copy); every later change
 * is written to both.
 *
 * Whether anyone is signed in arrives as props because the session lives on
 * the Track page. The rules live in {@link createPreferenceSync}; this is
 * the wiring.
 */
export function usePracticePreferencesSync({
  signedIn,
  userKey,
}: {
  /** Nobody signed in: only the device copy moves. */
  signedIn: boolean;
  /** Whose account was adopted: signing in as someone else adopts again. */
  userKey: string | null;
}) {
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;
  const sync = useRef<PreferenceSync | null>(null);

  useEffect(() => {
    const engine = createPreferenceSync(() => signedInRef.current);
    sync.current = engine;
    return () => {
      sync.current = null;
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    if (!signedIn || userKey === null) {
      sync.current?.signOut();
      return;
    }
    void sync.current?.adopt(userKey);
  }, [signedIn, userKey]);
}
