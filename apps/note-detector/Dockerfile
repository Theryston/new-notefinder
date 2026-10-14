# The RunPod serverless image. Built from this directory as the context (see
# .dockerignore), published to GHCR by .github/workflows/note-detector-image.yml.
#
# CUDA 12.6, a runtime RunPod hosts support. The torch and onnxruntime-gpu CUDA
# libraries (cuBLAS, cuDNN, ...) come bundled in the PyPI wheels pinned in
# pyproject.toml, so the `base` flavor is enough: it supplies the NVIDIA driver
# interface and the minimal system libraries. The `runtime` flavor adds CUDA
# libraries that the wheels already carry, and it is bigger on disk, which the
# image build can't spare on a hosted runner. Python 3.12 is installed by uv
# from .python-version.
FROM nvidia/cuda:12.6.0-base-ubuntu22.04

COPY --from=ghcr.io/astral-sh/uv:0.11.32 /uv /usr/local/bin/uv

ENV UV_PYTHON_INSTALL_DIR=/opt/python \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR /app

# The dependencies come first, so a change to the code does not reinstall
# the CUDA stack. `--locked` fails the build when uv.lock is out of date.
# uv hard-links the venv from its cache (the default), so the packages are
# stored once; the cache is then removed in the same step, so it never stays
# in an image layer. The GitHub-hosted runner runs out of disk without this.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev --group model && uv cache clean

# The model weights are downloaded here, pinned by sha256, one step per model
# (see CLAUDE.md).

# GAME medium, from its official ONNX release. weights.py only needs the
# standard library, so it runs before the code is copied, and the build fails
# if a file's sha256 differs from the one pinned in game-weights.json.
COPY game-weights.json /tmp/game/game-weights.json
COPY note_detector/weights.py /tmp/game/weights.py
RUN python /tmp/game/weights.py /tmp/game/game-weights.json \
      /app/weights/game-medium \
    && rm -rf /tmp/game

COPY note_detector ./note_detector

# The git sha of the build, reported as `note-detector@<sha>` in every job
# output. Declared after the dependency layer so a new commit does not
# reinstall the CUDA stack.
ARG GIT_SHA=unknown
ENV NOTE_DETECTOR_GIT_SHA=$GIT_SHA

CMD ["python", "-u", "-m", "note_detector"]
