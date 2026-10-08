# apps/nfp-audio: vocal notes worker

Read the root `CLAUDE.md` first; this file only adds this app's rules.

A **RunPod serverless** worker: given a Track's music WAV, it separates the
vocals (`voice_extract.pth`, a CascadedNet), uploads them, and detects the
vocal notes with CREPE. It is the legacy `nfp-audio` repo moved in as code
(copied at `e658d26`), reshaped for the new pipeline (ADR 0004).

It **never calls the API** and holds **no storage credentials**. Everything it
needs arrives in the job input as URLs; everything it produces leaves as the
job output. It is not a library: nothing imports it.

Python, not Node. The monorepo runs it through Turbo with a thin `package.json`
that calls `uv`.

## The job contract

RunPod runs one job per `/run` call. The API starts the job and polls
`/status`.

Input (`job.input`, camelCase, validated in `nfp_audio/contract.py`):

```json
{
  "processingId": "…",
  "musicUrl": "https://…/music.wav",
  "vocalsUpload": {
    "presignedPutUrl": "https://…?X-Amz-…",
    "contentType": "audio/wav",
    "publicUrl": "https://…/vocals.wav"
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
  "notes": [
    { "note": "A#", "octave": 4, "start": 1.23, "end": 1.61, "frequencyMean": 468.2 }
  ]
}
```

The fields of each note are camelCase on the wire, `frequencyMean` included
(a maintainer decision; the issue text said `frequency_mean`). In Python the
attribute stays `frequency_mean`, and `Note.to_dict` maps it.

`vocalsUrl` is the `publicUrl` it was given: the file is uploaded with the
presigned PUT and the `Content-Type` from the input. `notes` is ordered by
time. An invalid input or a failed step raises, which RunPod reports as
`FAILED`; the API maps that to `NOTE_DETECTION_FAILED`.

The detection parameters (confidence 0.85, minimum note 0.05 s, merge gap
0.2 s, CREPE `full` with Viterbi, 10 ms steps) and the separation parameters
(44.1 kHz, FFT 2048, hop 1024, crop 256, batch 4) are the legacy worker's. Do
not change them without re-checking Tracks against the legacy output.

## Layout

- `nfp_audio/contract.py`, `handler.py`, `notes.py`: pure logic, no models.
  The handler takes its steps as injected callables, so the contract is tested
  with fakes.
- `nfp_audio/transfer.py`: the music download and the presigned upload.
- `nfp_audio/separation.py`, `pitch.py`, `vocals_model/`: the model stack
  (torch, CREPE). Glue only the GPU image exercises.
- `nfp_audio/__main__.py`: the RunPod entrypoint, which wires the real steps.
- `models/voice_extract.pth`: the weights, a regular git blob (59 MB, below
  GitHub's 100 MB hard limit). This is a maintainer decision: the weights are
  not in Git LFS.

## Commands (from `apps/nfp-audio`, or `nub run <task> --filter=@notefinder/nfp-audio`)

```sh
uv sync                      # dependencies of the dev group (tests and lint)
uv sync --group model        # plus the model stack (Linux, with the GPU wheels)
uv run --locked pytest       # unit tests (no models needed)
uv run --locked pytest --cov # + coverage report (no threshold yet)
uv run --locked ruff check . && uv run --locked ruff format --check .
```

`--locked` makes a stale `uv.lock` fail the run instead of silently
re-resolving. Regenerate the lock with `uv lock` after changing dependencies.

Python is pinned in `.python-version` (3.12). The legacy image used 3.10, which
reaches end of life in October 2026, so the move to 3.12 is deliberate.

## Dependencies

- `torch` is pinned to `>=2.7,<2.8`. The PyPI builds of that line bundle
  CUDA 12.6, the runtime the legacy image was built on. Newer PyPI builds
  bundle CUDA 13.
- `crepe==0.0.16` is only published as an sdist. Its `setup.py` downloads the
  model weights from `github.com/marl/crepe` at build time, and it imports
  `pkg_resources`, so the build is pinned to `setuptools<81`. For the lock,
  `[[tool.uv.dependency-metadata]]` gives its requirements statically: building
  it just to lock would need GitHub at lock time. Installing still builds it,
  so the machine that installs needs GitHub access.
- `tensorflow[and-cuda]` is pinned to 2.20 because its NVIDIA pins overlap
  torch 2.7's (2.21 wants NCCL 2.27, torch wants 2.26).

## Publishing

`.github/workflows/nfp-audio-image.yml` builds the image from this directory
(`Dockerfile`, linux/amd64, CUDA 12.6 base) on every pull request that touches
it, and publishes it to GHCR on a push to `main`:

- `ghcr.io/theryston/new-notefinder/nfp-audio:latest` moves with `main`;
- `…:sha-<short>` is immutable.

The checkout is a plain `actions/checkout`: the weights are a regular blob, so
no LFS fetch is needed. RunPod serverless endpoints pull the image by tag, so
pin an endpoint to a `sha-` tag when a release must not move.

The image is large (torch, TensorFlow and the CUDA libraries); the hosted
runner's disk is the limit to watch when a build fails for space.
