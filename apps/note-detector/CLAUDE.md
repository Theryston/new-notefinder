# apps/note-detector: Note detection worker

Read the root `CLAUDE.md` first; this file only adds this app's rules.

A **RunPod serverless** worker that replaces `apps/nfp-audio` (ADR 0007). Given
a Track's music WAV it separates the vocals, uploads them, finds the Vocal
notes and computes the Pitch curve. The decision and the benchmark behind the
models are in `docs/adr/0007-note-detector-replaces-nfp-audio.md`.

It **never calls the API** and holds **no storage credentials**. Everything it
needs arrives in the job input as URLs; everything it produces leaves through
presigned uploads and the job output. It is not a library: nothing imports it.

Python, not Node. The monorepo runs it through Turbo with a thin `package.json`
that calls `uv`.

**State today:** the job contract, the handler, the Pitch curve encoding, the
transfer helpers, the image and the Vocal notes step (GAME medium) exist. The
other two model steps (vocal separation, Pitch curve) are not wired yet:
`__main__.py` raises for each until its adapter lands, so a half-built image
can never complete a Processing.

## The job contract

RunPod runs one job per `/run` call. The API starts the job and polls
`/status`.

Input (`job.input`, camelCase, validated in `note_detector/contract.py`):

```json
{
  "processingId": "…",
  "musicUrl": "https://…/music.wav",
  "vocalsUpload": {
    "presignedPutUrl": "https://…?X-Amz-…",
    "contentType": "audio/wav",
    "publicUrl": "https://…/vocals.wav"
  },
  "pitchCurveUpload": {
    "presignedPutUrl": "https://…?X-Amz-…",
    "contentType": "application/octet-stream",
    "publicUrl": "https://…/pitch-curve.bin"
  }
}
```

Progress: the handler reports `EXTRACTING_VOCALS` (before the download, so it
covers the whole vocal stage), then `DETECTING_NOTES`, as RunPod progress
updates. The API maps those to the Processing's statuses. The stage names are
part of the contract; do not rename them.

Output (`COMPLETED`):

```json
{
  "vocalsUrl": "https://…/vocals.wav",
  "pitchCurveUrl": "https://…/pitch-curve.bin",
  "detectorVersion": "note-detector@<git sha>",
  "notes": [{ "pitch": 61.49, "start": 1.23, "end": 1.61 }]
}
```

- `pitch` is a continuous MIDI number (A4 = 69). Clients name the nearest key.
- `start`/`end` are seconds from the start of the music. `notes` is ordered by
  time (the handler sorts them, whatever the detector returns).
- `vocalsUrl` and `pitchCurveUrl` are the `publicUrl`s the worker was given.
- Any invalid input or failed step raises, which RunPod reports as `FAILED`;
  the API maps that to `NOTE_DETECTION_FAILED`. The Pitch curve is mandatory:
  a failure to compute or upload it fails the whole job.

### The Pitch curve file

Little-endian Uint16, one value per 10 ms frame from t = 0. A value is
`round(MIDI x 100)` and `0` means no voice at that frame. Content type
`application/octet-stream`. Encoding (`pitch_curve.py`): halves round up,
unvoiced (0, negative, NaN) is `0`, a voiced frame never encodes as `0`, and
values clamp to 65535.

### Detector version

The image is built with `--build-arg GIT_SHA=<sha>`, which becomes the
`NOTE_DETECTOR_GIT_SHA` env var; the worker reports `note-detector@<sha>`
(`unknown` outside an image). Weights are pinned by checksum in the repo, so
the sha identifies code and models.

## Layout

- `note_detector/contract.py`, `handler.py`, `notes.py`, `pitch_curve.py`,
  `version.py`: pure logic, no models. The handler takes its steps as injected
  callables, so the contract is tested with fakes.
- `note_detector/transfer.py`: the music download and the presigned uploads.
- `note_detector/__main__.py`: the RunPod entrypoint, which wires the real
  steps. Glue only the GPU image exercises, so it is omitted from coverage.

Pure modules are covered at 100% (`fail_under = 100`); model adapters, when
they land, are omitted from coverage and checked by parity tests that run only
when the weights are present.

## Vocal notes: GAME medium (ONNX)

The Vocal notes come from GAME medium (openvpi/GAME, MIT), run from its
official ONNX release (v1.0.3, medium) on `onnxruntime-gpu`, through our own
loop that reproduces GAME's `infer.py extract`. No GAME training code, torch
or Lightning is involved.

- `game_slicer.py`: a port of GAME's `slicer2.py` with `extract`'s parameters
  (-40 dB, 1 s minimum clip, 200 ms minimum silence, 100 ms kept). The vocals
  are cut at silences; silence-only vocals give no clip. GAME's branch for a
  silence no longer than the kept silence is left out: those parameters never
  reach it.
- `game_decode.py`: the D3PM loop control (`d3pm_times`, `sample_boundaries`)
  and the decoding of boundaries into regions and of regions into notes
  (clip offset, clamping to the clip length, unvoiced regions dropped, overlap
  trimming between clips, as GAME's callbacks do).
- `game_pipeline.py`: per clip, encoder, then the segmenter's D3PM sampling,
  then the estimator, behind the `GameModules` protocol, so it is tested with
  fakes. Pure, covered at 100%.
- `game.py`: the onnxruntime adapter (omitted from coverage). The three
  sessions (`encoder`, `segmenter`, `estimator`; `dur2bd`/`bd2dur` are not
  needed, their work is in `game_decode.py`) are created once per worker, in
  `main()`, before the first job. Clips run one at a time (batch 1).
- `weights.py` + `game-weights.json`: the image build downloads the release
  files and checks each sha256 (see Weights).

GAME's defaults, all in `game_decode.py`: 8 D3PM steps from t0 = 0
(`t = 0, 1/8 .. 7/8`), boundary threshold 0.2, boundary radius 0.02 s (2
frames of 10 ms), presence threshold 0.2, language 0 (unset: the model has no
Portuguese and "unset" measured as good as "en"). The model's sample rate
(44.1 kHz) and timestep come from the release's `config.json`. The vocals the
separation step writes are 44.1 kHz; any other rate fails the job.

The notes' `pitch` is GAME's continuous MIDI score of the region.

### Weights

`game-weights.json` lists the files of the release (`config.json`,
`encoder.onnx`, `segmenter.onnx`, `estimator.onnx`) with their url and
sha256. The Dockerfile runs `weights.py` over it, and the build fails when a
file has no pinned url/sha256 or its checksum differs. They are baked into
`/app/weights/game-medium` (override with `NOTE_DETECTOR_GAME_DIR`); a cold
start never touches the network.

### Parity test

`tests/test_game_parity.py` (marker `parity`) runs only when the weights are
present. It runs GAME's official `infer.py extract` (PyTorch checkpoint, from
a checkout of openvpi/GAME and its own environment) and our ONNX loop on the
same short vocals fixture, then compares: note count within 10%, 90% of the
official notes matched by onset and offset within 50 ms, and pitches within
half a semitone. D3PM sampling is stochastic on both sides, hence the
tolerance. The environment variables it reads are listed in the module
docstring. Its second test checks our slicer cuts exactly like GAME's
`slicer2.py` (needs only `GAME_REPO`).

## Commands (from `apps/note-detector`, or `nub run <task> --filter=note-detector`)

```sh
uv sync                      # dependencies of the dev group (tests and lint)
uv sync --group model        # plus the model stack (Linux, with the GPU wheels)
uv run --locked pytest       # unit tests (no models needed)
uv run --locked pytest --cov # + coverage report, fails below 100%
uv run --locked ruff check . && uv run --locked ruff format --check .
```

`--locked` makes a stale `uv.lock` fail the run instead of silently
re-resolving. Regenerate the lock with `uv lock` after changing dependencies.

Python is pinned in `.python-version` (3.12).

## Dependencies

- `torch` is pinned to `>=2.7,<2.8`. The PyPI builds of that line bundle
  CUDA 12.6; newer PyPI builds bundle CUDA 13 and need a newer driver than
  RunPod hosts may have.
- `onnxruntime-gpu` is pinned to `>=1.22,<1.27`: 1.26 is the last release
  built for CUDA 12 (1.27 and later depend on CUDA 13 libraries). It reuses
  the cuDNN/cuBLAS libraries torch brings.

## Publishing

`.github/workflows/note-detector-image.yml` builds the image from this
directory (`Dockerfile`, linux/amd64, CUDA 12.6 base) on every pull request
that touches it, and publishes it to GHCR on a push to `main`:

- `ghcr.io/theryston/new-notefinder/note-detector:latest` moves with `main`;
- `…:sha-<short>` is immutable.

The workflow passes the commit as the `GIT_SHA` build arg. RunPod serverless
endpoints pull the image by tag, so pin an endpoint to a `sha-` tag when a
release must not move. The weights (about 1.3 GB) will be downloaded at build
time and verified against pinned sha256 checksums; clean caches in the same
layer, as the existing steps do, because the hosted runner's disk is the limit.
