'use client';

import { useTranslations } from 'next-intl';
import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { AudioWaveform } from './audio-waveform';

import { LoopHandles } from './loop-handles';

type TrackElements = {
  fill: RefObject<HTMLDivElement | null>;
  thumb: RefObject<HTMLDivElement | null>;
  remaining: RefObject<HTMLSpanElement | null>;
  slider: RefObject<HTMLDivElement | null>;
};

/**
 * Writes the playback position into the track's elements from a store
 * subscription, so playing re-renders nothing. Screen readers hear the value
 * once a second, not once a frame.
 */
function useProgressPainting(
  elements: TrackElements,
  total: string,
  showRemaining: boolean,
) {
  const t = useTranslations('tracks.practice.dock');
  const format = useClockFormat();

  useEffect(() => {
    const { fill, thumb, remaining, slider } = elements;
    let previousTime: string | undefined;
    const paint = () => {
      const { time, duration } = playbackStore.getState();
      const fraction = fractionOfTime(time, duration);
      const current = format(time);
      const text = showRemaining
        ? t('remainingTime', {
            time: format(Math.ceil(Math.max(0, duration - time))),
          })
        : current;
      if (fill.current) fill.current.style.transform = `scaleX(${fraction})`;
      if (thumb.current) thumb.current.style.left = `${fraction * 100}%`;
      if (!remaining.current || previousTime === current) return;
      previousTime = current;
      remaining.current.textContent = text;
      slider.current?.setAttribute('aria-valuenow', String(Math.round(time)));
      slider.current?.setAttribute(
        'aria-valuetext',
        t('progressValue', { current, total }),
      );
    };
    paint();
    return playbackStore.subscribe(paint);
  }, [elements, format, total, t, showRemaining]);
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
        ' ': () => controller?.toggle(),
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
  'flex h-10 w-12 shrink-0 cursor-pointer items-center justify-end rounded-full font-mono text-muted-foreground text-xs tabular-nums outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * The thin played-versus-total bar, shown only without direct audio: there
 * the waveform itself carries the progress, so this stays out.
 */
function ProgressBar({
  elements,
}: {
  elements: Pick<TrackElements, 'fill' | 'thumb'>;
}) {
  return (
    <div className="relative h-1 w-full rounded-full bg-foreground/15">
      <div
        ref={elements.fill}
        className="absolute inset-0 origin-left rounded-full bg-primary"
        style={{ transform: 'scaleX(0)' }}
      />
      <div
        ref={elements.thumb}
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm transition-transform duration-200 ease-spring group-hover:scale-125 group-aria-disabled:hidden"
        style={{ left: '0%' }}
      />
    </div>
  );
}

/**
 * The progress track of the dock: a bar to click or drag to seek, followed by
 * a button that toggles remaining and elapsed time. The slider still announces
 * elapsed time and duration. With direct audio the waveform itself is the
 * track (played bars in primary, the rest muted), so the thin bar stays out.
 */
export function DockProgressTrack({
  controller,
  waveform,
}: {
  controller: PlaybackController | null;
  waveform?: readonly number[];
}) {
  const t = useTranslations('tracks.practice.dock');
  const format = useClockFormat();
  const duration = usePlaybackState((state) => state.duration);
  const [showRemaining, setShowRemaining] = useState(true);
  const fill = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const remaining = useRef<HTMLSpanElement>(null);
  const slider = useRef<HTMLDivElement>(null);
  // Refs never change, so neither does this: the subscription is kept.
  const elements = useMemo<TrackElements>(
    () => ({ fill, thumb, remaining, slider }),
    [],
  );
  const seek = useSeekHandlers(controller, duration);
  const total = format(duration);
  useProgressPainting(elements, total, showRemaining);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {/* The hit area is taller than the bar, so it is easy to grab. */}
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
        {waveform !== undefined && <AudioWaveform controller={controller} />}
        {waveform === undefined && <ProgressBar elements={elements} />}
        <LoopHandles
          duration={duration}
          sizedToWaveform={waveform !== undefined}
        />
      </div>
      <button
        type="button"
        aria-label={t(showRemaining ? 'showElapsedTime' : 'showRemainingTime')}
        className={TIME_CLASS}
        onClick={() => setShowRemaining((value) => !value)}
      >
        <span
          ref={elements.remaining}
          data-testid="dock-remaining-time"
          aria-hidden="true"
        >
          {t('remainingTime', { time: total })}
        </span>
      </button>
    </div>
  );
}
