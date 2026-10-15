import { describe, expect, it, vi } from 'vitest';
import type { ModelDetector } from './model-pipeline';
import { createPitchEngine } from './pitch-engine';
import { activationFor } from './synthetic-activation';
import { syntheticTone } from './synthetic-tone';

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup(loadModel: () => Promise<ModelDetector>) {
  const onReading = vi.fn();
  const log = vi.fn();
  const engine = createPitchEngine({
    sampleRate: 16000,
    loadModel,
    onReading,
    log,
  });
  return { engine, onReading, log };
}
const tone = () =>
  syntheticTone({ frequency: 440, sampleRate: 16000, length: 512 });

describe('pitch engine terminal lifecycle', () => {
  it.each(['resolve', 'reject'] as const)(
    'ignores an inference that will %s after stop',
    async (outcome) => {
      const inference = deferred<Float32Array>();
      const dispose = vi.fn();
      const { engine, onReading, log } = setup(async () => ({
        detect: () => inference.promise,
        dispose,
      }));
      await Promise.resolve();
      engine.feed(tone());
      engine.stop();
      log.mockClear();
      if (outcome === 'resolve') inference.resolve(activationFor(440));
      else inference.reject(new Error('late failure'));
      await Promise.resolve();
      engine.feed(tone());
      expect(onReading).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(dispose).toHaveBeenCalledOnce();
    },
  );

  it('ignores queued classic samples after stop', async () => {
    const { engine, onReading } = setup(() => new Promise(() => {}));
    engine.stop();
    for (let i = 0; i < 8; i += 1) engine.feed(tone());
    await Promise.resolve();
    expect(onReading).not.toHaveBeenCalled();
  });

  it.each(['failed', 'too-slow'])(
    'releases a model on %s fallback',
    async (reason) => {
      const inference = deferred<Float32Array>();
      const dispose = vi.fn();
      const { engine, log } = setup(async () => ({
        detect: () => inference.promise,
        dispose,
      }));
      await Promise.resolve();
      engine.feed(tone());
      if (reason === 'failed') inference.reject(new Error('failed inference'));
      else for (let i = 0; i < 8; i += 1) engine.feed(tone());
      await Promise.resolve();
      expect(log.mock.calls.flat().join(' ')).toContain(`gave up (${reason})`);
      expect(dispose).toHaveBeenCalledOnce();
      engine.stop();
      expect(dispose).toHaveBeenCalledOnce();
    },
  );

  it('releases a model arriving after stop without starting it', async () => {
    const loading = deferred<ModelDetector>();
    const { engine, log } = setup(() => loading.promise);
    engine.stop();
    log.mockClear();
    const dispose = vi.fn();
    const detect = vi.fn();
    loading.resolve({ detect, dispose });
    await Promise.resolve();
    engine.feed(tone());
    expect(dispose).toHaveBeenCalledOnce();
    expect(detect).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('ignores a late model loading failure', async () => {
    const loading = deferred<ModelDetector>();
    const { engine, log } = setup(() => loading.promise);
    engine.stop();
    log.mockClear();
    loading.reject(new Error('late download failure'));
    await Promise.resolve();
    expect(log).not.toHaveBeenCalled();
  });
});
