import { describe, expect, it, vi } from 'vitest';
import {
  MAX_DROPPED_FRAMES,
  type ModelDetector,
  ModelPipeline,
} from './model-pipeline';
import { activationFor } from './synthetic-activation';
import { syntheticTone } from './synthetic-tone';

const RATE = 48_000;

function setup(detector: ModelDetector) {
  const readings: (number | null)[] = [];
  const onGiveUp = vi.fn();
  const pipeline = new ModelPipeline(RATE, detector, {
    onReading: (midi) => readings.push(midi),
    onGiveUp,
  });
  return { pipeline, readings, onGiveUp };
}

/** Feeds `seconds` of a tone in 128-sample blocks, letting the model answer. */
async function sing(pipeline: ModelPipeline, seconds: number) {
  const total = Math.round(seconds * RATE);
  for (let at = 0; at < total; at += 128) {
    pipeline.feed(
      syntheticTone({
        frequency: 440,
        sampleRate: RATE,
        length: 128,
        start: at,
      }),
    );
    await Promise.resolve();
  }
}

describe('ModelPipeline', () => {
  it('reads the note the model hears, once per hop', async () => {
    const detect = vi.fn(() => Promise.resolve(activationFor(440)));
    const { pipeline, readings } = setup({ detect });
    await sing(pipeline, 0.5);
    await vi.waitFor(() => expect(readings.length).toBeGreaterThan(10));
    expect(readings.at(-1)).toBeCloseTo(69, 0);
    // 0.5 s is about 15 hops of 32 ms.
    expect(detect.mock.calls.length).toBeLessThanOrEqual(16);
  });

  it('hands the model a normalized 1024-sample frame', async () => {
    const detect = vi.fn((_frame: Float32Array) =>
      Promise.resolve(activationFor(440)),
    );
    const { pipeline } = setup({ detect });
    await sing(pipeline, 0.2);
    const frame = detect.mock.calls[0]?.[0];
    expect(frame).toHaveLength(1024);
    const mean = (frame?.reduce((sum, v) => sum + v, 0) ?? 0) / 1024;
    expect(mean).toBeCloseTo(0, 2);
  });

  it('does not ask the model about silence', async () => {
    const detect = vi.fn(() => Promise.resolve(activationFor(440)));
    const { pipeline, readings } = setup({ detect });
    for (let i = 0; i < 400; i += 1) pipeline.feed(new Float32Array(128));
    expect(detect).not.toHaveBeenCalled();
    expect(readings.length).toBeGreaterThan(0);
    expect(readings.every((midi) => midi === null)).toBe(true);
  });

  it('gives up when the model fails', async () => {
    const detect = vi.fn(() => Promise.reject(new Error('boom')));
    const { pipeline, onGiveUp } = setup({ detect });
    await sing(pipeline, 0.3);
    await vi.waitFor(() => expect(onGiveUp).toHaveBeenCalledWith('failed'));
    expect(onGiveUp).toHaveBeenCalledOnce();
  });

  it('gives up when it can’t keep up with real time', async () => {
    // Never answers: every later hop finds the model busy.
    const detect = vi.fn(() => new Promise<Float32Array>(() => {}));
    const { pipeline, onGiveUp } = setup({ detect });
    await sing(pipeline, 0.032 * (MAX_DROPPED_FRAMES + 3));
    expect(onGiveUp).toHaveBeenCalledWith('too-slow');
    expect(onGiveUp).toHaveBeenCalledOnce();
  });

  it('forgives a few busy hops in a row', async () => {
    let answer: (value: Float32Array) => void = () => {};
    const detect = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Float32Array>((resolve) => (answer = resolve)),
      )
      .mockResolvedValue(activationFor(440));
    const { pipeline, onGiveUp } = setup({ detect });
    await sing(pipeline, 0.032 * (MAX_DROPPED_FRAMES - 2));
    answer(activationFor(440));
    await sing(pipeline, 0.3);
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  it('stops reporting after it gave up', async () => {
    const detect = vi.fn(() => Promise.reject(new Error('boom')));
    const { pipeline, readings } = setup({ detect });
    await sing(pipeline, 0.3);
    await vi.waitFor(() => expect(detect).toHaveBeenCalled());
    const before = detect.mock.calls.length;
    await sing(pipeline, 0.3);
    expect(detect.mock.calls.length).toBe(before);
    expect(readings).toEqual([]);
  });

  it('spans the model’s window', () => {
    expect(setup({ detect: vi.fn() }).pipeline.windowSeconds).toBeCloseTo(
      0.064,
    );
  });
});
