import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Runs before `next dev` and `next build`: ONNX Runtime Web's WASM (about
// 14 MB) is served from our own origin, as the pitch engine asks for it, and
// is not worth committing. `public/ort` is git-ignored.
const FILE = 'ort-wasm-simd-threaded.wasm';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const target = join(root, 'public', 'ort');
mkdirSync(target, { recursive: true });
copyFileSync(join(dist, FILE), join(target, FILE));
