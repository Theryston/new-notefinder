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
    await session.release();
    throw new Error('unexpected model signature');
  }
  return createDetector({ ort, session, input, output });
}

type Runtime = typeof import('onnxruntime-web/wasm');
type CrepeSession = {
  ort: Runtime;
  session: import('onnxruntime-web/wasm').InferenceSession;
  input: string;
  output: string;
};

function createDetector({
  ort,
  session,
  input,
  output,
}: CrepeSession): ModelDetector {
  let running: Promise<Float32Array> | undefined;
  let releasing: Promise<void> | undefined;
  return {
    detect: (frame) => {
      if (releasing !== undefined)
        return Promise.reject(new Error('the model is stopped'));
      running = runFrame({ ort, session, input, output }, frame);
      return running;
    },
    dispose: () => {
      // ORT must finish using the session before its WASM allocations go away.
      releasing ??= Promise.resolve(running)
        .catch(() => {})
        .then(() => session.release());
      return releasing;
    },
  };
}

async function runFrame(
  { ort, session, input, output }: CrepeSession,
  frame: Float32Array,
): Promise<Float32Array> {
  const tensor = new ort.Tensor('float32', frame, [1, frame.length]);
  let result: Awaited<ReturnType<typeof session.run>> | undefined;
  try {
    result = await session.run({ [input]: tensor });
    const probabilities = result[output]?.data;
    if (!(probabilities instanceof Float32Array)) {
      throw new Error('the model returned no float probabilities');
    }
    // Own the values before disposing the runtime's output tensor.
    return probabilities.slice();
  } finally {
    tensor.dispose();
    for (const value of Object.values(result ?? {})) value.dispose();
  }
}
