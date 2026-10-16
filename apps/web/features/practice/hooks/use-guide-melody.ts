import type { TrackNote } from '@notefinder/contracts';
import { useEffect, useState } from 'react';

import { startGuidePlayer } from '../guide-player';
import { createSingingSynth, resumeSingingAudio } from '../singing-synth';

type Playback = { getState(): { status: string; time: number; rate: number } };

/** Follows the player clock, so seeks, direct audio and YouTube share timing. */
export function useGuideMelody(
  notes: readonly TrackNote[],
  playback: Playback,
  enabled: boolean,
) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stop = () => {};
    setFailed(false);
    const unlock = () => {
      void resumeSingingAudio().catch(() => {
        if (!cancelled) setFailed(true);
      });
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    void createSingingSynth()
      .then((synth) => {
        if (cancelled) {
          synth.dispose();
          return;
        }
        const stopPlayer = startGuidePlayer({ notes, playback, synth });
        stop = () => {
          stopPlayer();
          synth.dispose();
        };
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      stop();
    };
  }, [notes, playback, enabled]);
  return failed;
}
