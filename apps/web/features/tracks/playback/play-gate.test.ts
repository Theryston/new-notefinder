import { expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { FakePlayer } from '../player/fake-player';
import { initialPlaybackState } from '../stores/playback-store';
import { PlaybackController } from './playback-controller';

it('delays play entry points and cancels pending play on pause or dispose', async () => {
  const port = new FakePlayer({ durationSeconds: 100 });
  const store = createStore(() => initialPlaybackState);
  const controller = new PlaybackController({
    port,
    store,
    frames: { request: () => 1, cancel: () => {} },
    durationHint: 100,
  });
  await port.load();
  let release = () => {};
  const cancel = vi.fn();
  controller.setPlayGate((start) => {
    release = start;
    return cancel;
  });
  controller.toggle();
  expect(store.getState().status).toBe('ready');
  controller.toggle();
  expect(cancel).toHaveBeenCalledOnce();
  release();
  expect(store.getState().status).not.toBe('playing');
  controller.play();
  release();
  expect(store.getState().status).toBe('playing');
  controller.pause();
  controller.play();
  controller.dispose();
  release();
  expect(store.getState().status).not.toBe('playing');
});
