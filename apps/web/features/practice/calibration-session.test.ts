import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeCalibrationReading } from './calibration-reading';
import { startCalibration } from './calibration-session';
import { createSingingSynth } from './singing-synth';

vi.mock('./singing-synth', () => ({ createSingingSynth: vi.fn() }));
const synth = { play: vi.fn(), dispose: vi.fn(), stop: vi.fn() };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.mocked(createSingingSynth).mockResolvedValue(synth);
});
afterEach(() => {
  vi.useRealTimers();
});
describe('singing calibration', () => {
  it('measures alternating sung responses after existing automatic compensation', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now * 1000);
    const onDone = vi.fn();
    const onBeat = vi.fn();
    const cancel = startCalibration({ onDone, onBeat, onError: vi.fn() });
    await Promise.resolve();
    for (let beat = 0; beat < 10; beat++) {
      now = beat + 0.2;
      observeCalibrationReading(beat % 2 === 0 ? 69 : 72, 0.05);
      now = beat + 0.4;
      observeCalibrationReading(null, 0.05);
      now = beat + 1;
      vi.advanceTimersByTime(1000);
    }
    expect(onDone).toHaveBeenCalledWith(expect.closeTo(0.15));
    expect(onBeat.mock.calls.map(([count]) => count)).toEqual([
      10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
    expect(synth.dispose).toHaveBeenCalledOnce();
    cancel();
  });
  it('rejects silence instead of saving a guessed offset', async () => {
    const onDone = vi.fn();
    const cancel = startCalibration({
      onDone,
      onBeat: vi.fn(),
      onError: vi.fn(),
    });
    await Promise.resolve();
    vi.advanceTimersByTime(10_000);
    expect(onDone).toHaveBeenCalledWith(null);
    cancel();
  });
  it('releases an in-progress session and ignores later readings', async () => {
    const onDone = vi.fn();
    const cancel = startCalibration({
      onDone,
      onBeat: vi.fn(),
      onError: vi.fn(),
    });
    await Promise.resolve();
    cancel();
    observeCalibrationReading(69, 0);
    vi.advanceTimersByTime(11_000);
    expect(onDone).not.toHaveBeenCalled();
    expect(synth.dispose).toHaveBeenCalledOnce();
  });
  it('releases a synth that finishes loading after cancellation', async () => {
    const cancel = startCalibration({
      onDone: vi.fn(),
      onBeat: vi.fn(),
      onError: vi.fn(),
    });
    cancel();
    await Promise.resolve();
    expect(synth.play).not.toHaveBeenCalled();
    expect(synth.dispose).toHaveBeenCalledOnce();
  });
  it('reports unavailable audio without an unhandled rejection', async () => {
    vi.mocked(createSingingSynth).mockRejectedValue(new Error('blocked'));
    const onError = vi.fn();
    startCalibration({ onDone: vi.fn(), onBeat: vi.fn(), onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
  });
});
