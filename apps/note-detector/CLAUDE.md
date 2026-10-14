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
transfer helpers and the image exist. Of the three model steps (vocal
separation, Vocal notes, Pitch curve) the Pitch curve is wired; `__main__.py`
raises for each of the others until its adapter lands, so a half-built image
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

## Pitch curve (RMVPE)

`note_detector/rmvpe.py` computes the Pitch curve of the separated vocals;
`__main__.py` wires it as the `pitch_curve` step. The pure maths (mel
filterbank, chunk plan, salience decoding) is in `rmvpe_math.py`, covered at
100%. `rmvpe.py` is model glue, omitted from coverage.

- **Model:** RMVPE, run in fp32 on CUDA (CPU if there is none), loaded once per
  worker process (`load_rmvpe` is cached).
- **Code:** the network classes are vendored in `note_detector/vendor/rmvpe/`
  (Apache-2.0, `LICENSE` and `NOTICE` kept; source and commit in the notice).
  The checkpoint uses `DeepUnet0`, so the unused timbre filter it builds is
  deleted to keep the weights load strict. `vendor/` is excluded from Ruff
  and from coverage; do not restyle it.
- **Weights:** the RVC project's `rmvpe.pt` (MIT, 181 MB), pinned to a commit
  of `lj1995/VoiceConversionWebUI` on Hugging Face and verified by sha256
  (`6d62215f...c193`) by `fetch_weights.py` in a Dockerfile `RUN`. They live at
  `/app/weights/rmvpe.pt`. To change the model, change the URL and the
  checksum in the Dockerfile together.
- **Parameters:** audio mixed to mono and resampled to 16 kHz; centered STFT
  with 1024 window and 160-sample hop (10 ms), 128 HTK mel bins from 30 Hz to
  8 kHz, log with a 1e-5 floor. The salience (360 bins, 20 cents apart) is
  decoded by the weighted mean of the 9 bins around the peak. **Voicing
  threshold 0.03**, raw: a frame whose peak is at or below it is unvoiced
  (`0`), and the Vocal notes never mask it. Frame `i` is centered at
  `i x 10 ms`, so the curve starts at t = 0 and has `samples // 160 + 1`
  frames. The spectrogram is run in chunks of 6400 frames with 320 frames of
  context on each side (discarded), to bound memory on long Tracks.
- **Check:** `tests/test_rmvpe_weights.py` (marker `rmvpe`) runs the real
  model on a synthetic sung tone with vibrato and on a vowel-like phrase and
  asserts the curve is within 25 cents of the truth. It skips unless the model
  stack is installed and the weights exist (`RMVPE_WEIGHTS`, default
  `/app/weights/rmvpe.pt`): `RMVPE_WEIGHTS=... uv run pytest -m rmvpe`.

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
