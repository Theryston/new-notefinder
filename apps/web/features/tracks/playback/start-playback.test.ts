import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { FakePlayer } from '../player/fake-player';
import type { PlayerPort } from '../player/player-port';
import {
  initialPlaybackState,
  type PlaybackState,
} from '../stores/playback-store';
import type { PlaybackController } from './playback-controller';
import { startPlayback } from './start-playback';

const frames = { request: () => 1, cancel: () => undefined };

/** A player the test creates and finishes by hand. */
function setUp(overrides: { durationHint?: number } = {}) {
  const store = createStore<PlaybackState>(() => ({
    ...initialPlaybackState,
    status: 'error',
  }));
  const controllers: (PlaybackController | null)[] = [];
  let resolvePlayer: (player: PlayerPort) => void = () => undefined;
  let rejectPlayer: (error: Error) => void = () => undefined;
  const makePlayer = vi.fn(
    () =>
      new Promise<PlayerPort>((resolve, reject) => {
        resolvePlayer = resolve;
        rejectPlayer = reject;
      }),
  );
  const session = startPlayback({
    host: {} as unknown as HTMLElement,
    videoId: 'abc123',
    fake: true,
    durationHint: overrides.durationHint ?? 0,
    store,
    frames,
    makePlayer,
    onController: (controller) => controllers.push(controller),
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return {
    store,
    session,
    controllers,
    makePlayer,
    settle,
    resolvePlayer: (player: PlayerPort) => resolvePlayer(player),
    rejectPlayer: (error: Error) => rejectPlayer(error),
  };
}

describe('startPlayback', () => {
  it('starts from a clean store and asks for the player with the hint', () => {
    const { store, makePlayer } = setUp({ durationHint: 215 });

    expect(store.getState().status).toBe('loading');
    expect(makePlayer).toHaveBeenCalledWith({
      host: expect.anything(),
      durationSeconds: 215,
      fake: true,
    });
  });

  it('hands out the controller and loads the video once the player exists', async () => {
    const { controllers, resolvePlayer, settle, store } = setUp();
    const player = new FakePlayer({ durationSeconds: 100 });
    const load = vi.spyOn(player, 'load');

    resolvePlayer(player);
    await settle();

    expect(controllers).toHaveLength(1);
    expect(controllers[0]).not.toBeNull();
    expect(load).toHaveBeenCalledWith('abc123');
    expect(store.getState().status).toBe('ready');
  });

  it('shows an error instead of loading forever when the player cannot be made', async () => {
    const { store, rejectPlayer, settle, controllers } = setUp();

    rejectPlayer(new Error('the IFrame API is blocked'));
    await settle();

    expect(store.getState().status).toBe('error');
    expect(controllers).toEqual([]);
  });

  it('destroys a player that arrives after the session was disposed', async () => {
    const { session, resolvePlayer, settle, controllers } = setUp();
    const player = new FakePlayer({ durationSeconds: 100 });
    const destroy = vi.spyOn(player, 'destroy');

    session.dispose();
    resolvePlayer(player);
    await settle();

    expect(destroy).toHaveBeenCalledOnce();
    expect(controllers).toEqual([null]);
  });

  it('stays quiet about a failure that comes after it was disposed', async () => {
    const { session, store, rejectPlayer, settle } = setUp();
    session.dispose();
    store.setState({ status: 'ready' });

    rejectPlayer(new Error('late'));
    await settle();

    expect(store.getState().status).toBe('ready');
  });

  it('disposes the controller and the player, telling the page it is gone', async () => {
    const { session, resolvePlayer, settle, controllers } = setUp();
    const player = new FakePlayer({ durationSeconds: 100 });
    const destroy = vi.spyOn(player, 'destroy');
    resolvePlayer(player);
    await settle();

    session.dispose();

    expect(destroy).toHaveBeenCalledOnce();
    expect(controllers.at(-1)).toBeNull();
  });

  it('takes a later Track length without making another player', async () => {
    const { session, store, makePlayer, resolvePlayer, settle } = setUp();
    session.setDurationHint(120);
    expect(makePlayer).toHaveBeenCalledOnce();
    const player = new FakePlayer({ durationSeconds: 0 });
    // The player does not know its length yet, so the header's hint stands.
    vi.spyOn(player, 'duration').mockReturnValue(0);
    resolvePlayer(player);
    await settle();
    expect(store.getState().duration).toBe(120);

    session.setDurationHint(200);

    expect(store.getState().duration).toBe(200);
    expect(makePlayer).toHaveBeenCalledOnce();
  });
});
