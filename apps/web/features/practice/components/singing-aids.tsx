'use client';

import type { TrackNote } from '@vozzify/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useGuideMelody } from '../hooks/use-guide-melody';
import { micStore } from '../stores/mic-store';
import { loadSingingAids, useSingingAids } from '../stores/singing-aids-store';

type Controller = {
  setPlayGate(
    gate: ((start: () => void) => (() => void) | undefined) | undefined,
  ): void;
  cancelPendingPlay(): void;
};
type Playback = { getState(): { status: string; time: number; rate: number } };

/** Count-in is attached to the controller, covering the dock and shortcuts. */
export function SingingAids({
  controller,
  playback,
  notes,
}: {
  controller: Controller | null;
  playback: Playback;
  notes: readonly TrackNote[];
}) {
  const t = useTranslations('practice.aids');
  const countIn = useSingingAids((state) => state.countIn);
  const guide = useSingingAids((state) => state.guideMelody);
  const [count, setCount] = useState<number | null>(null);
  const failed = useGuideMelody(notes, playback, guide);
  useEffect(loadSingingAids, []);
  useEffect(() => {
    if (!controller) return;
    controller.setPlayGate((start) => {
      if (!countIn || micStore.getState().status !== 'on') {
        start();
        return;
      }
      let remaining = 3;
      setCount(remaining);
      const timer = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) setCount(remaining);
        else {
          clearInterval(timer);
          setCount(null);
          start();
        }
      }, 1000);
      return () => {
        clearInterval(timer);
        setCount(null);
      };
    });
    const cancel = micStore.subscribe((state) => {
      if (state.status !== 'on') controller.cancelPendingPlay();
    });
    const hide = () => {
      if (document.hidden) controller.cancelPendingPlay();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      controller.setPlayGate(undefined);
      cancel();
      document.removeEventListener('visibilitychange', hide);
    };
  }, [controller, countIn]);
  return (
    <>
      {count !== null && (
        <div
          role="status"
          aria-live="assertive"
          data-testid="singing-count-in"
          className="glass fixed inset-0 z-40 m-auto flex size-24 items-center justify-center rounded-full font-mono text-5xl"
        >
          {t('count', { count })}
        </div>
      )}
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t('audioError')}
        </p>
      )}
    </>
  );
}
