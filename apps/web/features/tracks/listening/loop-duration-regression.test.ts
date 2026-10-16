import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import {
  initialPlaybackState,
  type PlaybackState,
} from '../stores/playback-store';
import { bindSectionLoop } from './bind-section-loop';
import type { LoopRange } from './listening-math';

import { loopRange, moveLoopHandle } from './listening-math';

describe('loop ranges after the real duration replaces a hint', () => {
  it('keeps both handles within a shorter duration without crossing', () => {
    expect(moveLoopHandle({ start: 50, end: 60 }, 'end', 25, 30)).toEqual({
      start: 29.9,
      end: 30,
    });
    expect(moveLoopHandle({ start: 50, end: 60 }, 'start', 55, 30)).toEqual({
      start: 29.9,
      end: 30,
    });
    expect(moveLoopHandle({ start: 1, end: 2 }, 'end', 1, 0)).toBeNull();
    expect(loopRange(50, 60, 30)).toEqual({ start: 29.9, end: 30 });
  });
});

it('reconciles a shorter real duration before seeking without recursive loops', () => {
  const playback = createStore<PlaybackState>(() => ({
    ...initialPlaybackState,
    status: 'playing' as const,
    duration: 60,
    time: 55,
  }));
  const loop = createStore<{ range: LoopRange | null }>(() => ({
    range: { start: 50, end: 60 },
  }));
  const seeks: number[] = [];
  const stop = bindSectionLoop({
    playback,
    loop,
    controller: {
      seek: (time) => {
        seeks.push(time);
        playback.setState({ time });
      },
      play: () => {
        throw new Error('playing loop must not restart the player');
      },
    },
  });
  playback.setState({ duration: 30, time: 30 });
  expect(loop.getState().range).toEqual({ start: 29.9, end: 30 });
  expect(seeks).toEqual([29.9]);
  playback.setState({ duration: 0 });
  expect(loop.getState().range).toBeNull();
  stop();
});
