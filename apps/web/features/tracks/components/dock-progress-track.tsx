'use client';

import { useTranslations } from 'next-intl';
import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
} from 'react';

import { useClockFormat } from '../hooks/use-clock-format';
import type { PlaybackController } from '../playback/playback-controller';
import {
  fractionAtPointer,
  fractionOfTime,
  SKIP_SECONDS,
  timeAtFraction,
} from '../playback/playback-math';
import { playbackStore, usePlaybackState } from '../stores/playback-store';

type TrackElements = {
  fill: RefObject<HTMLDivElement | null>;
  thumb: RefObject<HTMLDivElement | null>;
  current: RefObject<HTMLSpanElement | null>;
  slider: RefObject<HTMLDivElement | null>;
};

/**
 * Writes the playback position into the track's elements from a store
 * subscription, so playing re-renders nothing. Screen readers hear the value
 * once a second, not once a frame.
 */
function useProgressPainting(elements: TrackElements, total: string) {
  const t = useTranslations('tracks.practice.dock');
  const format = useClockFormat();

  useEffect(() => {
    const { fill, thumb, current, slider } = elements;
    const paint = () => {
      const { time, duration } = playbackStore.getState();
      const fraction = fractionOfTime(time, duration);
      const text = format(time);
      if (fill.current) fill.current.style.transform = `scaleX(${fraction})`;
      if (thumb.current) thumb.current.style.left = `${fraction * 100}%`;
      if (!current.current || current.current.textContent === text) return;
      current.current.textContent = text;
      slider.current?.setAttribute('aria-valuenow', String(Math.round(time)));
      slider.current?.setAttribute(
        'aria-valuetext',
        t('progressValue', { current: text, total }),
      );
    };
    paint();
    return playbackStore.subscribe(paint);
  }, [elements, format, total, t]);
}

/** Click, drag and keys on the bar all end in a seek. */
function useSeekHandlers(
  controller: PlaybackController | null,
  duration: number,
) {
  const dragging = useRef(false);
  const enabled = controller !== null && duration > 0;
  const seekTo = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    controller?.seek(
      timeAtFraction(fractionAtPointer(event.clientX, box), duration),
    );
  };

  return {
    enabled,
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = true;
      seekTo(event);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (dragging.current) seekTo(event);
    },
    onPointerEnd: () => {
      dragging.current = false;
    },
    onKeyDown: (event: KeyboardEvent) => {
      const keys: Record<string, () => void> = {
        ArrowRight: () => controller?.skip(SKIP_SECONDS),
        ArrowLeft: () => controller?.skip(-SKIP_SECONDS),
        Home: () => controller?.seek(0),
        End: () => controller?.seek(duration),
      };
      const action = keys[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    },
  };
}

const TIME_CLASS =
  'w-10 shrink-0 font-mono text-muted-foreground text-xs tabular-nums';

/**
 * The progress track of the dock: the current time, a bar to click or drag to
 * seek, and the duration.
 */
export function DockProgressTrack({
  controller,
}: {
  controller: PlaybackController | null;
}) {
  const t = useTranslations('tracks.practice.dock');
  const format = useClockFormat();
  const duration = usePlaybackState((state) => state.duration);
  const elements: TrackElements = {
    fill: useRef(null),
    thumb: useRef(null),
    current: useRef(null),
    slider: useRef(null),
  };
  const seek = useSeekHandlers(controller, duration);
  const total = format(duration);
  useProgressPainting(elements, total);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span
        ref={elements.current}
        aria-hidden="true"
        className={`${TIME_CLASS} text-right`}
      />
      {/* The hit area is taller than the 4px bar, so it is easy to grab. */}
      <div
        ref={elements.slider}
        role="slider"
        tabIndex={seek.enabled ? 0 : -1}
        aria-label={t('progress')}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={0}
        aria-disabled={!seek.enabled}
        onKeyDown={seek.onKeyDown}
        onPointerDown={seek.onPointerDown}
        onPointerMove={seek.onPointerMove}
        onPointerUp={seek.onPointerEnd}
        onPointerCancel={seek.onPointerEnd}
        className="group relative flex h-8 min-w-0 flex-1 cursor-pointer touch-none items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:cursor-default"
      >
        <div className="relative h-1 w-full rounded-full bg-foreground/15">
          <div
            ref={elements.fill}
            className="absolute inset-0 origin-left rounded-full bg-primary"
            style={{ transform: 'scaleX(0)' }}
          />
          <div
            ref={elements.thumb}
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm transition-transform group-hover:scale-125 group-aria-disabled:hidden"
            style={{ left: '0%' }}
          />
        </div>
      </div>
      <span aria-hidden="true" className={TIME_CLASS}>
        {total}
      </span>
    </div>
  );
}
