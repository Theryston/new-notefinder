'use client';

import { useEffect } from 'react';

import { autoGuideMelody, useSingingAids } from '../stores/singing-aids-store';

/**
 * Keeps automatic guide changes following the transposition while the
 * transpose popover is closed. A component (not a hook) because the owner
 * lives in another feature, which may only use this feature's components:
 * the transposition travels as a plain prop, never a cross-feature store.
 */
export function GuideMelodyAuto({ semitones }: { semitones: number }) {
  const guideMelody = useSingingAids((state) => state.guideMelody);

  useEffect(() => {
    if (guideMelody === (semitones !== 0)) return;
    autoGuideMelody(semitones !== 0);
  }, [semitones, guideMelody]);

  return null;
}
