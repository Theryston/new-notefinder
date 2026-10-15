'use client';

import { useSyncExternalStore } from 'react';
import type { PlaybackController } from '../playback/playback-controller';
import { playbackStore } from '../stores/playback-store';

const EMPTY: readonly number[] = [];
const emptyPeaks = () => EMPTY;

/** The source's decoded amplitudes, inside the dock's existing seek target. */
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
  const path = peaks
    .map((peak, index) => {
      const height = Math.max(2, peak * 30);
      return `M${index * 3},${16 - height / 2}v${height}`;
    })
    .join(' ');
  return (
    <svg
      aria-hidden="true"
      data-testid="audio-waveform"
      viewBox={`0 0 ${Math.max(1, peaks.length) * 3} 32`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-8 w-full text-primary"
    >
      <path d={path} stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}
