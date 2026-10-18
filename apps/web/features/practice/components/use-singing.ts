'use client';

import { useEffect, useState } from 'react';

import { SingingDetector } from '../singing-detector';
import { useMicState } from '../stores/mic-store';
import { voiceTrail } from '../voice-trail';

/**
 * Whether the User is singing into an open mic. Listening alone, or a mic that
 * is off or still starting, is not singing. The state is dropped when the mic
 * turns off, so a later session starts silent.
 */
export function useSinging(): boolean {
  const micOn = useMicState((state) => state.status === 'on');
  const [singing, setSinging] = useState(false);

  useEffect(() => {
    if (!micOn) return;
    const detector = new SingingDetector();
    const stop = voiceTrail.subscribe(() => {
      setSinging(detector.push(voiceTrail.latest()));
    });
    return () => {
      stop();
      setSinging(false);
    };
  }, [micOn]);

  // The cleanup's reset only reaches the next render, so the mic gates it here.
  return micOn && singing;
}
