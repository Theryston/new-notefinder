'use client';

import { useEffect } from 'react';

import { autoGuideMelody, useSingingAids } from '../stores/singing-aids-store';

/** Keep automatic guide changes active while the transpose popover is closed. */
export function GuideMelodyAuto({
  semitones,
  directAudio,
}: {
  semitones: number;
  directAudio: boolean;
}) {
  const guideMelody = useSingingAids((state) => state.guideMelody);

  useEffect(() => {
    if (directAudio || guideMelody === (semitones !== 0)) return;
    autoGuideMelody(semitones !== 0);
  }, [semitones, directAudio, guideMelody]);

  return null;
}
