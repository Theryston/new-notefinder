import type { ModelDetector } from './model-pipeline';

/**
 * Where the files are served from: our own origin, never a CDN. The model is
 * in `public/models`; the runtime's WASM is copied into `public/ort` by
 * `scripts/copy-ort-wasm.ts` before dev and build.
 */
const MODEL_URL = '/models/crepe-tiny.onnx';
const WASM_URL = '/ort/ort-wasm-simd-threaded.wasm';

/**
 * Loads the CREPE tiny model into ONNX Runtime Web. Both the runtime and the
 * model are fetched here, on the first call, so a page that never turns the
 * mic on never downloads them (the browser caches both afterwards).
 */
export async function loadCrepeModel(): Promise<ModelDetector> {
  const ort = await import('onnxruntime-web/wasm');
  // One thread: multi-threaded WASM needs cross-origin isolation headers.
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = { wasm: WASM_URL };
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`model request failed: ${response.status}`);
  const session = await ort.InferenceSession.create(
    new Uint8Array(await response.arrayBuffer()),
  );
  const input = session.inputNames[0];
  const output = session.outputNames[0];
  if (input === undefined || output === undefined) {
    throw new Error('unexpected model signature');
  }
  return {
    detect: async (frame) => {
      const tensor = new ort.Tensor('float32', frame, [1, frame.length]);
      const result = await session.run({ [input]: tensor });
      const probabilities = result[output]?.data;
      if (!probabilities) throw new Error('the model returned nothing');
      return probabilities as Float32Array;
    },
  };
}
