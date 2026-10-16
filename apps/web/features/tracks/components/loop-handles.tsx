'use client';

import { useTranslations } from 'next-intl';
import { type PointerEvent, useRef } from 'react';

import { moveLoopHandle } from '../listening/listening-math';
import { useLoop } from '../listening/loop-store';
import { fractionAtPointer, timeAtFraction } from '../playback/playback-math';

/** Native range thumbs inset their endpoints by half their hit width. Map
 * pointer positions to the whole progress track, just like its seek handler. */
function useHandlePointer(duration: number) {
  const dragging = useRef(false);
  const grabOffset = useRef(0);
  return (handle: 'start' | 'end') => {
    const move = (event: PointerEvent<HTMLInputElement>) => {
      const { range } = useLoop.getState();
      if (!range) return;
      const fraction = fractionAtPointer(
        event.clientX - grabOffset.current,
        (
          event.currentTarget.parentElement ?? event.currentTarget
        ).getBoundingClientRect(),
      );
      useLoop.setState({
        range: moveLoopHandle(
          range,
          handle,
          timeAtFraction(fraction, duration),
          duration,
        ),
      });
    };
    return {
      onPointerDown: (event: PointerEvent<HTMLInputElement>) => {
        event.stopPropagation();
        if (event.button !== 0) return;
        event.preventDefault();
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        const { range } = useLoop.getState();
        const box = (
          event.currentTarget.parentElement ?? event.currentTarget
        ).getBoundingClientRect();
        grabOffset.current =
          event.clientX -
          box.x -
          ((range?.[handle] ?? 0) / duration) * box.width;
      },
      onPointerMove: (event: PointerEvent<HTMLInputElement>) => {
        if (dragging.current) move(event);
      },
      onPointerUp: () => {
        dragging.current = false;
      },
      onPointerCancel: () => {
        dragging.current = false;
      },
    };
  };
}

export function LoopHandles({ duration }: { duration: number }) {
  const pointer = useHandlePointer(duration);
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
          {...pointer(handle)}
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
          className="loop-handle pointer-events-none absolute top-0 -left-5 h-10 w-[calc(100%+2.5rem)] appearance-none bg-transparent"
        />
      ))}
    </>
  );
}
