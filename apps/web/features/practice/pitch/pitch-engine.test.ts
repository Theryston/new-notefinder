import { describe, expect, it, vi } from 'vitest';
import { MAX_DROPPED_FRAMES, type ModelDetector } from './model-pipeline';
import { createPitchEngine } from './pitch-engine';
import { activationFor } from './synthetic-activation';
import { syntheticTone } from './synthetic-tone';

const RATE = 48_000;

function setup(loadModel: () => Promise<ModelDetector>) {
  const readings: { midi: number | null; window: number }[] = [];
  const log = vi.fn();
  const engine = createPitchEngine({
    sampleRate: RATE,
    loadModel,
    onReading: (midi, window) => readings.push({ midi, window }),
    log,
  });
  return { engine, readings, log };
}

/** An engine whose model loads at once and answers with `detect`. */
const setupModel = (detect: ModelDetector['detect']) =>
  setup(() => Promise.resolve({ detect }));

/** The newest reading is YIN's: an A4 from its 2048-sample window. */
function expectYin(readings: { midi: number | null; window: number }[]) {
  expect(readings.at(-1)?.midi).toBeCloseTo(69, 0);
  expect(readings.at(-1)?.window).toBeCloseTo(2048 / RATE);
}

let position = 0;
async function sing(
  engine: { feed(block: Float32Array): void },
  seconds: number,
) {
  const total = Math.round(seconds * RATE);
  for (let at = 0; at < total; at += 128) {
    engine.feed(
      syntheticTone({
        frequency: 440,
        sampleRate: RATE,
        length: 128,
        harmonics: [0.3],
        start: position,
      }),
    );
    position += 128;
    await Promise.resolve();
  }
}

const logged = (log: ReturnType<typeof vi.fn>) =>
  log.mock.calls.map(([message]) => String(message)).join('\n');

describe('createPitchEngine', () => {
  it('answers with YIN straight away, before the model has loaded', async () => {
    const { engine, readings } = setup(() => new Promise(() => {}));
    await sing(engine, 0.3);
    expectYin(readings);
  });

  it('switches to the model once it has loaded', async () => {
    const detect = vi.fn(() => Promise.resolve(activationFor(440)));
    const { engine, readings, log } = setupModel(detect);
    await sing(engine, 0.5);
    await vi.waitFor(() => expect(detect).toHaveBeenCalled());
    expect(logged(log)).toContain('ML model');
    await vi.waitFor(() => expect(readings.at(-1)?.window).toBeCloseTo(0.064));
    expect(readings.at(-1)?.midi).toBeCloseTo(69, 0);
  });

  it('stays on YIN when the model fails to load', async () => {
    const { engine, readings, log } = setup(() =>
      Promise.reject(new Error('404')),
    );
    await sing(engine, 0.3);
    await vi.waitFor(() => expect(logged(log)).toContain('failed to load'));
    await sing(engine, 0.3);
    expectYin(readings);
  });

  it('goes back to YIN when the model fails while running', async () => {
    const detect = vi.fn(() => Promise.reject(new Error('boom')));
    const { engine, readings, log } = setupModel(detect);
    await sing(engine, 0.3);
    await vi.waitFor(() => expect(logged(log)).toContain('gave up (failed)'));
    await sing(engine, 0.4);
    expectYin(readings);
  });

  it('goes back to YIN when the model is too slow for real time', async () => {
    const detect = vi.fn(() => new Promise<Float32Array>(() => {}));
    const { engine, readings, log } = setupModel(detect);
    await sing(engine, 0.032 * (MAX_DROPPED_FRAMES + 6));
    expect(logged(log)).toContain('gave up (too-slow)');
    await sing(engine, 0.4);
    expectYin(readings);
  });

  it('ignores a model that loads after the engine was stopped', async () => {
    let load: (detector: ModelDetector) => void = () => {};
    const { engine, log } = setup(
      () => new Promise((resolve) => (load = resolve)),
    );
    engine.stop();
    load({ detect: vi.fn() });
    await Promise.resolve();
    expect(logged(log)).not.toContain('ML model');
  });
});
