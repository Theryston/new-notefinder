import { afterEach, describe, expect, it, vi } from 'vitest';

import { initialPlaybackState, playbackStore } from '../stores/playback-store';
import { playbackClock } from './playback-clock';

afterEach(() => {
  playbackStore.setState(initialPlaybackState);
});

describe('playbackClock', () => {
  it('reads the time of the playback store', () => {
    playbackStore.setState({ time: 42.5 });

    expect(playbackClock.now()).toBe(42.5);
  });

  it('tells a subscriber when the store changes, until it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = playbackClock.subscribe(listener);

    playbackStore.setState({ time: 1 });
    unsubscribe();
    playbackStore.setState({ time: 2 });

    expect(listener).toHaveBeenCalledOnce();
  });
});
