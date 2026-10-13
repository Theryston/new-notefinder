import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { FakePlayer } from '../player/fake-player';
import {
  initialPlaybackState,
  type PlaybackState,
} from '../stores/playback-store';
import { type FrameScheduler, PlaybackController } from './playback-controller';

let clock = 0;
let pending = new Map<number, () => void>();
let nextHandle = 1;

const frames: FrameScheduler = {
  request: (callback) => {
    const handle = nextHandle++;
    pending.set(handle, callback);
    return handle;
  },
  cancel: (handle) => {
    pending.delete(handle);
  },
};

/** Runs the frame callbacks that are waiting, as one screen refresh. */
function runFrame() {
  const callbacks = [...pending.values()];
  pending = new Map();
  for (const callback of callbacks) callback();
}

async function setUp(durationSeconds = 100) {
  const player = new FakePlayer({ durationSeconds, now: () => clock });
  const store = createStore<PlaybackState>(() => initialPlaybackState);
  const controller = new PlaybackController({
    port: player,
    store,
    frames,
    durationHint: durationSeconds,
  });
  await player.load();
  return { controller, store };
}

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  clock = 0;
  pending = new Map();
  nextHandle = 1;
});

describe('PlaybackController', () => {
  it('starts loading with the Track length from the header', () => {
    const player = new FakePlayer({ durationSeconds: 100, now: () => clock });
    const store = createStore<PlaybackState>(() => initialPlaybackState);

    new PlaybackController({ port: player, store, frames, durationHint: 248 });

    expect(store.getState()).toMatchObject({
      status: 'loading',
      duration: 248,
    });
  });

  it('becomes ready when the player is', async () => {
    const { store } = await setUp();

    expect(store.getState().status).toBe('ready');
  });

  it('ignores play until the player is ready', () => {
    const player = new FakePlayer({ durationSeconds: 100, now: () => clock });
    const store = createStore<PlaybackState>(() => initialPlaybackState);
    const controller = new PlaybackController({
      port: player,
      store,
      frames,
      durationHint: 100,
    });

    controller.play();

    expect(store.getState().status).toBe('loading');
  });

  it('follows the player time once a frame while playing', async () => {
    const { controller, store } = await setUp();

    controller.play();
    clock = 1500;
    runFrame();

    expect(store.getState().status).toBe('playing');
    expect(store.getState().time).toBe(1.5);
    clock = 2500;
    runFrame();
    expect(store.getState().time).toBe(2.5);
  });

  it('stops reading frames when paused', async () => {
    const { controller, store } = await setUp();
    controller.play();
    clock = 2000;
    runFrame();

    controller.pause();

    expect(pending.size).toBe(0);
    expect(store.getState()).toMatchObject({ status: 'paused', time: 2 });
  });

  it('toggles between playing and paused', async () => {
    const { controller, store } = await setUp();

    controller.toggle();
    expect(store.getState().status).toBe('playing');
    controller.toggle();
    expect(store.getState().status).toBe('paused');
  });

  it('seeks inside the Track and moves the time at once', async () => {
    const { controller, store } = await setUp();

    controller.seek(42);
    expect(store.getState().time).toBe(42);
    controller.seek(900);
    expect(store.getState().time).toBe(100);
    controller.seek(-3);
    expect(store.getState().time).toBe(0);
  });

  it('skips from where it is, 5 seconds by default', async () => {
    const { controller, store } = await setUp();
    controller.seek(20);

    controller.skip();
    expect(store.getState().time).toBe(25);
    controller.skip(-10);
    expect(store.getState().time).toBe(15);
  });

  it('ends at the end of the Track and plays again from the start', async () => {
    vi.useFakeTimers();
    const { controller, store } = await setUp(10);
    controller.play();
    clock = 10_000;
    vi.advanceTimersByTime(10_000);
    expect(store.getState()).toMatchObject({ status: 'ended', time: 10 });

    controller.play();

    expect(store.getState().status).toBe('playing');
    expect(store.getState().time).toBe(0);
  });

  it('keeps the speed and the mute in the store', async () => {
    const { controller, store } = await setUp();

    controller.setRate(1.5);
    controller.toggleMuted();

    expect(store.getState()).toMatchObject({ rate: 1.5, muted: true });
    controller.toggleMuted();
    expect(store.getState().muted).toBe(false);
  });

  it('pauses when the video is hidden, and brings it back on play', async () => {
    const { controller, store } = await setUp();
    controller.play();

    controller.hideVideo();

    expect(store.getState()).toMatchObject({
      videoHidden: true,
      status: 'paused',
    });
    expect(pending.size).toBe(0);
    controller.play();
    expect(store.getState()).toMatchObject({
      videoHidden: false,
      status: 'playing',
    });
  });

  it('hides the video of a paused player without playing it', async () => {
    const { controller, store } = await setUp();

    controller.hideVideo();

    expect(store.getState()).toMatchObject({
      videoHidden: true,
      status: 'ready',
    });
  });

  it('stops everything when disposed', async () => {
    const { controller, store } = await setUp();
    controller.play();

    controller.dispose();

    expect(pending.size).toBe(0);
    store.setState({ status: 'ready' });
    expect(store.getState().status).toBe('ready');
  });
});
