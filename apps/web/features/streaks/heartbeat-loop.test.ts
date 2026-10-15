import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HEARTBEAT_INTERVAL_MS, startHeartbeatLoop } from './heartbeat-loop';

const RESULT = {
  status: {
    day: '2026-03-10',
    listenedSeconds: 5,
    targetSeconds: 300,
    completedToday: false,
    currentStreakDays: 0,
  },
  justCompleted: false,
  creditedSeconds: 5,
};

function setup() {
  const send = vi.fn().mockResolvedValue(RESULT);
  const beacon = vi.fn();
  const onResult = vi.fn();
  const loop = startHeartbeatLoop({
    now: () => performance.now(),
    timeZone: () => 'America/Sao_Paulo',
    send,
    beacon,
    onResult,
  });
  return { loop, send, beacon, onResult };
}

describe('startHeartbeatLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the playing time every 5 seconds with the time zone', async () => {
    const { loop, send, onResult } = setup();
    loop.setPlaying(true);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(send).toHaveBeenCalledExactlyOnceWith({
      elapsedSeconds: 5,
      timeZone: 'America/Sao_Paulo',
    });
    expect(onResult).toHaveBeenCalledWith(RESULT);
    loop.stop();
  });

  it('sends nothing while the music is paused', async () => {
    const { loop, send } = setup();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);

    expect(send).not.toHaveBeenCalled();
    loop.stop();
  });

  it('reports only the time that was played before a pause', async () => {
    const { loop, send } = setup();
    loop.setPlaying(true);
    await vi.advanceTimersByTimeAsync(2_000);
    loop.setPlaying(false);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(send).toHaveBeenCalledExactlyOnceWith({
      elapsedSeconds: 2,
      timeZone: 'America/Sao_Paulo',
    });
    loop.stop();
  });

  it('drops a heartbeat that fails and keeps going', async () => {
    const { loop, send, onResult } = setup();
    send.mockRejectedValueOnce(new Error('offline'));
    loop.setPlaying(true);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2);

    expect(send).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(1);
    loop.stop();
  });

  it('flushes the pending seconds through the beacon, once', async () => {
    const { loop, beacon, send } = setup();
    loop.setPlaying(true);
    await vi.advanceTimersByTimeAsync(3_000);

    loop.flushWithBeacon();
    loop.flushWithBeacon();

    expect(beacon).toHaveBeenCalledExactlyOnceWith({
      elapsedSeconds: 3,
      timeZone: 'America/Sao_Paulo',
    });
    expect(send).not.toHaveBeenCalled();
    loop.stop();
  });

  it('does not beacon less than a second', () => {
    const { loop, beacon } = setup();
    loop.setPlaying(true);

    loop.flushWithBeacon();

    expect(beacon).not.toHaveBeenCalled();
    loop.stop();
  });

  it('stops reporting after stop', async () => {
    const { loop, send } = setup();
    loop.setPlaying(true);
    loop.stop();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2);

    expect(send).not.toHaveBeenCalled();
  });
});
