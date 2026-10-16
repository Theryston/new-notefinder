import { afterEach, expect, it, vi } from 'vitest';
import { startGuidePlayer } from './guide-player';

afterEach(() => vi.useRealTimers());
it('follows target notes, transposition, speed, pauses and seeks through the existing player clock', () => {
  vi.useFakeTimers();
  const state = { status: 'playing', time: 0.5, rate: 1 };
  const synth = { play: vi.fn(), stop: vi.fn() };
  const stop = startGuidePlayer({
    notes: [
      { pitch: 72, start: 0, end: 2 },
      { pitch: 74, start: 3, end: 4 },
    ],
    playback: { getState: () => state },
    synth,
  });
  expect(synth.play).toHaveBeenLastCalledWith(72, 1.5);
  state.rate = 0.5;
  vi.advanceTimersByTime(16);
  expect(synth.play).toHaveBeenLastCalledWith(72, 3);
  state.status = 'paused';
  vi.advanceTimersByTime(16);
  expect(synth.stop).toHaveBeenCalledTimes(3);
  state.status = 'playing';
  state.time = 3.5;
  vi.advanceTimersByTime(16);
  expect(synth.play).toHaveBeenLastCalledWith(74, 1);
  state.time = 3.8;
  vi.advanceTimersByTime(16);
  expect(synth.play).toHaveBeenLastCalledWith(74, expect.closeTo(0.4));
  state.time = 0.25;
  vi.advanceTimersByTime(16);
  expect(synth.play).toHaveBeenLastCalledWith(72, 3.5);
  state.time = 2.5;
  vi.advanceTimersByTime(16);
  const calls = synth.play.mock.calls.length;
  stop();
  state.time = 3.5;
  vi.advanceTimersByTime(16);
  expect(synth.play).toHaveBeenCalledTimes(calls);
});
