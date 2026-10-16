'use client';

import { useTranslations } from 'next-intl';
import { type PointerEvent, useRef, useState } from 'react';

import { useClockFormat } from '../hooks/use-clock-format';
import { type LoopRange, moveLoopHandle } from '../listening/listening-math';
import { useLoop } from '../listening/loop-store';
import { fractionAtPointer, timeAtFraction } from '../playback/playback-math';

type HandleKind = 'start' | 'end';

/** Native range thumbs inset their endpoints by half their hit width. Map
 * pointer positions to the whole progress track, just like its seek handler. */
function useHandlePointer(
  duration: number,
  setActive: (handle: HandleKind | null) => void,
) {
  const dragging = useRef(false);
  const grabOffset = useRef(0);
  return (handle: HandleKind) => {
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
        setActive(handle);
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
        setActive(null);
      },
      onPointerCancel: () => {
        dragging.current = false;
        setActive(null);
      },
    };
  };
}

/**
 * Neutral pill window and high-contrast pill brackets (DESIGN.md: primary
 * stays exclusive to the current playback state). Decorative: the range inputs
 * own the accessible names and 40px hit targets.
 */
function LoopVisual({
  range,
  duration,
  active,
}: {
  range: LoopRange;
  duration: number;
  active: HandleKind | null;
}) {
  const format = useClockFormat();
  return (
    <>
      <div
        aria-hidden="true"
        data-testid="loop-region"
        className="pointer-events-none absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-foreground/10"
        style={{
          left: `${(range.start / duration) * 100}%`,
          width: `${((range.end - range.start) / duration) * 100}%`,
        }}
      />
      {(['start', 'end'] as const).map((handle) => {
        const dragging = active === handle;
        return (
          <div
            key={handle}
            aria-hidden="true"
            style={{ left: `${(range[handle] / duration) * 100}%` }}
            className={
              dragging
                ? 'pointer-events-none absolute top-1/2 h-4.5 w-1.5 -translate-x-1/2 -translate-y-1/2 scale-y-115 rounded-full bg-primary shadow-sm ring-2 ring-background transition-[transform,background-color] duration-150 ease-spring'
                : 'pointer-events-none absolute top-1/2 h-4.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm ring-2 ring-background transition-[transform,background-color] duration-150 ease-spring'
            }
          >
            <span
              className={
                dragging
                  ? 'absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 rounded-full bg-foreground px-1.5 py-0.5 font-mono font-semibold text-[10px] text-background tabular-nums opacity-100 shadow-sm transition-opacity duration-150'
                  : 'absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 rounded-full bg-foreground px-1.5 py-0.5 font-mono font-semibold text-[10px] text-background tabular-nums opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100'
              }
            >
              {format(range[handle])}
            </span>
          </div>
        );
      })}
    </>
  );
}

export function LoopHandles({ duration }: { duration: number }) {
  const [active, setActive] = useState<HandleKind | null>(null);
  const pointer = useHandlePointer(duration, setActive);
  const t = useTranslations('tracks.practice.listening');
  const range = useLoop((state) => state.range);
  if (!range || duration <= 0) return null;
  return (
    <>
      <LoopVisual range={range} duration={duration} active={active} />
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
