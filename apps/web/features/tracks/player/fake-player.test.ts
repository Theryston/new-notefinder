import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakePlayer } from './fake-player';
import type { PlayerState } from './player-port';

let clock = 0;
const now = () => clock;

function setUp(durationSeconds = 100) {
  const player = new FakePlayer({ durationSeconds, now });
  const states: PlayerState[] = [];
  player.onState((state) => states.push(state));
  return { player, states };
}

beforeEach(() => {
  clock = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FakePlayer', () => {
  it('is ready after load, and reports its length only then', async () => {
    const { player, states } = setUp();
    expect(player.isReady()).toBe(false);
    expect(player.duration()).toBe(0);

    await player.load();

    expect(player.isReady()).toBe(true);
    expect(player.duration()).toBe(100);
    expect(states).toEqual(['ready']);
  });

  it('runs its clock while playing and holds it while paused', async () => {
    const { player, states } = setUp();
    await player.load();

    player.play();
    clock = 3000;
    expect(player.currentTime()).toBe(3);
    player.pause();
    clock = 9000;

    expect(player.currentTime()).toBe(3);
    expect(states).toEqual(['ready', 'playing', 'paused']);
  });

  it('does not play before it is ready', () => {
    const { player, states } = setUp();

    player.play();

    expect(states).toEqual([]);
  });

  it('seeks while playing and while paused, inside the Track', async () => {
    const { player } = setUp();
    await player.load();

    player.seek(40);
    expect(player.currentTime()).toBe(40);
    player.play();
    clock = 2000;
    player.seek(500);

    expect(player.currentTime()).toBe(100);
    player.seek(-5);
    expect(player.currentTime()).toBe(0);
  });

  it('runs at the playback rate', async () => {
    const { player } = setUp();
    await player.load();
    player.play();
    clock = 2000;

    player.setRate(0.5);
    clock = 6000;

    expect(player.currentTime()).toBe(4);
  });

  it('ends at the end of the Track', async () => {
    const { player, states } = setUp(10);
    await player.load();
    player.play();

    clock = 10_000;
    vi.advanceTimersByTime(10_000);

    expect(states).toEqual(['ready', 'playing', 'ended']);
    expect(player.currentTime()).toBe(10);
  });

  it('does not end after a pause or once destroyed', async () => {
    const { player, states } = setUp(10);
    await player.load();
    player.play();
    player.pause();
    vi.advanceTimersByTime(60_000);
    player.destroy();

    expect(states).toEqual(['ready', 'playing', 'paused']);
  });

  it('stops notifying a listener that unsubscribed', async () => {
    const { player } = setUp();
    const seen: PlayerState[] = [];
    const stop = player.onState((state) => seen.push(state));
    stop();

    await player.load();

    expect(seen).toEqual([]);
  });
});
