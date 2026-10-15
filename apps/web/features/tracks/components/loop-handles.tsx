'use client';

import { useTranslations } from 'next-intl';

import { moveLoopHandle } from '../listening/listening-math';
import { useLoop } from '../listening/loop-store';

export function LoopHandles({ duration }: { duration: number }) {
  const t = useTranslations('tracks.practice.listening');
  const range = useLoop((state) => state.range);
  if (!range || duration <= 0) return null;
  return (
    <>
      {(['start', 'end'] as const).map((handle) => (
        <input
          key={handle}
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={range[handle]}
          aria-label={t(handle === 'start' ? 'loopStart' : 'loopEnd')}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onChange={(event) =>
            useLoop.setState({
              range: moveLoopHandle(
                range,
                handle,
                Number(event.target.value),
                duration,
              ),
            })
          }
          className="loop-handle pointer-events-none absolute inset-0 h-10 w-full appearance-none bg-transparent"
        />
      ))}
    </>
  );
}
