import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCrepeModel } from './crepe-model';

const runtime = vi.hoisted(() => ({
  inputNames: ['input'],
  outputNames: ['output'],
  run: vi.fn(),
  release: vi.fn(async () => {}),
  inputDispose: vi.fn(),
}));
vi.mock('onnxruntime-web/wasm', () => ({
  env: { wasm: {} },
  InferenceSession: { create: async () => runtime },
  Tensor: class {
    dispose = runtime.inputDispose;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  runtime.inputNames = ['input'];
});

async function load() {
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(0),
  }));
  return loadCrepeModel();
}

describe('CREPE runtime resource ownership', () => {
  it('waits for inference before release and disposes its input and output tensors', async () => {
    let complete: (value: object) => void = () => {};
    runtime.run.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const detector = await load();
    const inference = detector.detect(new Float32Array(1024));
    const released = detector.dispose?.();
    expect(runtime.release).not.toHaveBeenCalled();
    const outputDispose = vi.fn();
    complete({
      output: { data: new Float32Array([0.5]), dispose: outputDispose },
    });
    expect(await inference).toEqual(new Float32Array([0.5]));
    await released;
    expect(runtime.release).toHaveBeenCalledOnce();
    expect(runtime.inputDispose).toHaveBeenCalledOnce();
    expect(outputDispose).toHaveBeenCalledOnce();
    await detector.dispose?.();
    expect(runtime.release).toHaveBeenCalledOnce();
    await expect(detector.detect(new Float32Array(1024))).rejects.toThrow(
      'stopped',
    );
  });

  it('releases a session with an unexpected signature', async () => {
    runtime.inputNames = [];
    await expect(load()).rejects.toThrow('unexpected model signature');
    expect(runtime.release).toHaveBeenCalledOnce();
  });

  it('cleans up the input and releases the session after a failed inference', async () => {
    runtime.run.mockRejectedValueOnce(new Error('run failed'));
    const detector = await load();
    await expect(detector.detect(new Float32Array(1024))).rejects.toThrow(
      'run failed',
    );
    await detector.dispose?.();
    expect(runtime.inputDispose).toHaveBeenCalledOnce();
    expect(runtime.release).toHaveBeenCalledOnce();
  });
});
