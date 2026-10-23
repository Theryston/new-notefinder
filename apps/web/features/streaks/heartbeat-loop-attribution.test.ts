import { afterEach, describe, expect, it, vi } from 'vitest';
import { startHeartbeatLoop } from './heartbeat-loop';

afterEach(() => vi.useRealTimers());

describe('heartbeat view attribution', () => {
  it('sends and beacons the current view id', async () => {
    vi.useFakeTimers();
    let now = 0;
    const send = vi.fn().mockResolvedValue({ justCompleted: false });
    const beacon = vi.fn();
    const loop = startHeartbeatLoop({
      now: () => now,
      timeZone: () => 'UTC',
      viewId: () => 'view-1',
      send,
      beacon,
      onResult: vi.fn(),
    });
    loop.setPlaying(true);
    now = 5_000;
    await vi.advanceTimersByTimeAsync(5_000);

    expect(send).toHaveBeenCalledWith({
      elapsedSeconds: 5,
      timeZone: 'UTC',
      viewId: 'view-1',
    });

    now = 8_000;
    loop.flushWithBeacon();
    expect(beacon).toHaveBeenCalledWith({
      elapsedSeconds: 3,
      timeZone: 'UTC',
      viewId: 'view-1',
    });
    loop.stop();
  });

  it('sends heartbeats without a view id when none is available', async () => {
    vi.useFakeTimers();
    let now = 0;
    const send = vi.fn().mockResolvedValue({ justCompleted: false });
    const loop = startHeartbeatLoop({
      now: () => now,
      timeZone: () => 'UTC',
      send,
      beacon: vi.fn(),
      onResult: vi.fn(),
    });
    loop.setPlaying(true);
    now = 5_000;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(send).toHaveBeenCalledWith({ elapsedSeconds: 5, timeZone: 'UTC' });
    loop.stop();
  });
});
