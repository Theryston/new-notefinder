# 7. Note detection: Mel-RoFormer Kim, GAME and RMVPE replace CREPE and heuristics

- Status: accepted
- Date: 2026-10-14

## Context

The Vocal notes notefinder shows are mostly missing. `apps/nfp-audio` (ADR
0004), ported from the legacy app with its parameters frozen on purpose,
separates the vocals with a CascadedNet (about 8 dB vocals SDR, several dB
behind the state of the art, and it removes part of the voice with the music)
and then finds notes with CREPE plus heuristics:

- a confidence gate of 0.85 discards about 79% of the sung frames of separated
  vocals;
- every frame is rounded to a key and a new note starts whenever the key
  changes, so vibrato and slides shatter notes into 10-40 ms fragments that
  the 50 ms minimum then drops (1338 of 1529 groups on *Billie Jean*).

On *Billie Jean* the stored notes cover about 8% of the sung time and 248 of
373 sung words have no note at all. The image also carries TensorFlow and
PyTorch only to run CREPE, which makes it huge, slow to cold start and fragile
to build.

The legacy parameters were frozen so a Track's notes came out as they did
before the move. That is no longer a constraint: the catalog is reprocessed
into a new schema (ADR 0001), so existing note data is disposable.

## Decision

A new RunPod serverless worker, `apps/note-detector`, replaces `nfp-audio`. It
keeps the same shape (uv Python app, GHCR image, no API calls, no storage
credentials, injected steps in a pure handler) and changes the models and the
contract:

- **Vocal separation: Mel-Band RoFormer "Kim" vocals** (MIT weights, model
  class vendored from ZFTurbo's Music-Source-Separation-Training, MIT). Our
  own chunking and overlap-add, overlap 4, fp32, on CUDA.
- **Vocal notes: GAME medium (openvpi)**, a model made to transcribe singing
  into notes, run from its official ONNX release (MIT) with
  `onnxruntime-gpu` and our own small loop that reproduces GAME's inference
  (silence slicing, encoder, D3PM segmentation with GAME's defaults, estimator,
  voiced regions only). The language is always unset: measured equal or
  better than `en`, and GAME has no Portuguese.
- **Pitch curve: RMVPE** (code Apache-2.0, weights from RVC, MIT) on the
  separated vocals, with its own voicing, stored as a Uint16 file (one value
  per 10 ms, `round(MIDI x 100)`, `0` = no voice). It is stored only; no reader
  exists yet, so a later feature (the singer's real pitch line, finer mic
  feedback) will not need the catalog reprocessed.
- **The Vocal note becomes `{ pitch, start, end }`** with a continuous MIDI
  pitch. Clients name the nearest key from it.
- **The job reports `detectorVersion`** (`note-detector@<git sha>`). Weights
  are pinned by checksum and baked into the image at build time, so the sha
  identifies code and models and Tracks can be found and reprocessed when the
  models change.
- A failure to produce or upload the Pitch curve fails the job, so no
  completed Track lacks one.
- Target GPU is RunPod's A40 / RTX A6000 with CUDA 12.x for both torch and
  onnxruntime-gpu.

### Benchmark

Measured on CPU over three Tracks (English, Portuguese and a head-voice song),
with pYIN on the separated vocals as the pitch reference. "Coverage" is the
share of sung time that has a Vocal note.

| Track | Current coverage | New coverage | New sung time with the right pitch |
|---|---|---|---|
| Billie Jean | 0.08 | 0.80 | 0.55 |
| Olhar 43 (pt) | 0.07 | 0.71 | 0.61 |
| One (head voice) | 0.48 | 0.82 | 0.78 |

## Considered options

- **Ensemble separation** (averaging several separation models): measured, it
  tied or lost everywhere, and it costs more GPU time.
- **A karaoke / lead-vocal model** (to drop backing vocals): it removed the
  main voice, head voice especially, which is where the notes are hardest to
  get.
- **RMVPE-refined note pitches** (replacing each GAME note's pitch with RMVPE's
  over the same span): measured, it tied or lost
  everywhere, and it couples the notes to a second model for nothing. RMVPE stays for the Pitch curve.
- **Keeping CREPE and tuning the heuristics**: the gate and the grouping are
  what lose the notes, and the fragmentation comes from rounding every frame
  to a key, not from a parameter.
- **Fine-tuning GAME on notefinder's data**: out of scope; the off-the-shelf
  model already clears the bar.

## Consequences

- The contract between the API and the worker is rebuilt (two presigned
  uploads, new output); the API, `packages/contracts` and the web move to
  `{ pitch, start, end }` in sibling work, and `apps/nfp-audio` is deleted
  once the API runs on the new worker. ADR 0004's description of `nfp-audio`
  is superseded for the models and the contract; its pipeline, polling and
  stage names stand.
- The image drops TensorFlow and CREPE; it adds about 1.3 GB of weights,
  fetched at build time from fixed URLs and verified against sha256 checksums.
- License notices stay with the vendored code (ZFTurbo MIT, RMVPE
  Apache-2.0); the weights are Kim MIT, GAME MIT and RVC MIT.
- GAME's ONNX graph exposes presence only as a boolean, so a Vocal note has no
  confidence.
- Parity tests (our ONNX loop against GAME's official inference, our
  separation against the reference separator) run only when the weights are
  present, never in normal CI.
