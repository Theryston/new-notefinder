'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { PlaybackController } from '../playback/playback-controller';
import { fractionOfTime } from '../playback/playback-math';
import { playbackStore } from '../stores/playback-store';

const EMPTY: readonly number[] = [];
const emptyPeaks = () => EMPTY;

/**
 * The source's decoded amplitudes, acting as the dock's seek target: the
 * played bars show in primary and the rest muted. It paints from a store
 * subscription, so playing re-renders nothing. Clicks fall through to the
 * dock's slider, which still owns seeking and the accessible name.
 */
export function AudioWaveform({
  controller,
}: {
  controller: PlaybackController | null;
}) {
  const peaks = useSyncExternalStore(
    playbackStore.subscribe,
    controller?.waveform ?? emptyPeaks,
    emptyPeaks,
  );
  const played = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const paint = () => {
      const { time, duration } = playbackStore.getState();
      const fraction = fractionOfTime(time, duration);
      if (played.current)
        played.current.style.clipPath = `inset(0 ${(1 - fraction) * 100}% 0 0)`;
    };
    paint();
    return playbackStore.subscribe(paint);
  }, []);

  const path = peaks
    .map((peak, index) => {
      const height = Math.max(2, peak * 30);
      return `M${index * 3},${16 - height / 2}v${height}`;
    })
    .join(' ');
  const viewBox = `0 0 ${Math.max(1, peaks.length) * 3} 32`;
  return (
    <div
      aria-hidden="true"
      data-testid="audio-waveform"
      className="pointer-events-none absolute inset-0 h-8 w-full"
    >
      <svg
        aria-hidden="true"
        viewBox={viewBox}
        preserveAspectRatio="none"
        className="absolute inset-0 h-8 w-full text-foreground/20"
      >
        <path d={path} stroke="currentColor" strokeWidth={2} />
      </svg>
      <svg
        ref={played}
        aria-hidden="true"
        viewBox={viewBox}
        preserveAspectRatio="none"
        className="absolute inset-0 h-8 w-full text-primary"
        style={{ clipPath: 'inset(0 100% 0 0)' }}
      >
        <path d={path} stroke="currentColor" strokeWidth={2} />
      </svg>
    </div>
  );
}
