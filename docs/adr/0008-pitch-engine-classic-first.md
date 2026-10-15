# 8. The browser pitch engine: CREPE tiny first, YIN as the fallback

- Status: accepted
- Date: 2026-10-15

## Context

With the mic on, the practice page finds the note the user sings in real time
(spec #160, ticket #169). The spec asks for a pitch ML model of about 5 MB or
less as the primary engine and a classic YIN/MPM detector as the fallback, for
devices that cannot load or keep up with the model.

## Decision

- The engine is a set of small steps in `apps/web/features/practice`: an
  AudioWorklet captures the mic (echo cancellation and noise suppression on,
  auto gain off) and feeds the engine, which post-processes every reading
  (confidence gate, octave-slip correction, median of five).
- **Primary: CREPE tiny as ONNX**, run by `onnxruntime-web` (WASM, one thread,
  so no cross-origin isolation headers are needed). The mic's audio is brought
  down to 16 kHz and read in 1024-sample frames every 32 ms.
  - Model: `apps/web/public/models/crepe-tiny.onnx`, 1,955,762 bytes, from
    <https://github.com/yqzhishen/onnxcrepe/releases/download/v1.1.0/tiny.onnx>
    (onnxcrepe v1.1.0, MIT, (c) 2022 yqzhishen). The weights come from
    marl/crepe (MIT, (c) 2018 Jong Wook Kim). Both licenses allow
    redistribution; the notice is in `public/models/NOTICE.md`.
  - The runtime's WASM (about 14 MB) is served from our own origin, from
    `public/ort`. It is copied from `node_modules` by
    `scripts/copy-ort-wasm.ts` before `dev` and `build` and is git-ignored.
  - Runtime and model are dynamic imports and fetches made when the mic turns
    on; the first-load bundle does not change. The browser caches both.
- **Fallback: YIN.** YIN answers from the first sample, so the user never waits
  for the download. The model takes over once loaded. YIN takes back for the
  rest of the session if the model fails to load, fails while running, or
  cannot keep up (8 hops in a row arrive while the previous frame is still being
  run). Which engine runs shows in debug logs only.
- The voice line is placed on the Track's time minus the browser-reported
  output, base and input latency, plus half the active engine's window
  (`latencyCompensation`). A per-device calibration offset comes with the
  calibration ticket.

## Consequences

- Accuracy is judged by singing (no benchmark, per the spec); the unit tests
  check correctness on synthetic tones and the engine switching, and the e2e
  test checks the model path on a known A4.
- A visitor who turns the mic on downloads about 16 MB once (runtime plus
  model); later visits read it from the browser cache.
- The AudioWorklet module is a plain `.js` file next to the engine, loaded by
  `new URL(..., import.meta.url)`, because an AudioWorklet loads a file by URL
  and cannot run bundled TypeScript.
- `proxy.ts` leaves `.onnx` and `.wasm` requests alone, like other static
  assets, so they are not redirected to a locale.
