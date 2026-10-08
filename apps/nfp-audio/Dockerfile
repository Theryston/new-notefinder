# The RunPod serverless image. Built from this directory as the context (see
# .dockerignore), published to GHCR by .github/workflows/nfp-audio-image.yml.
#
# CUDA 12.6, the version the legacy worker was built on. The torch and
# TensorFlow CUDA libraries (cuBLAS, cuDNN, NCCL, ...) come bundled in the PyPI
# wheels pinned in pyproject.toml, so the `base` flavor is enough: it supplies
# the NVIDIA driver interface and the minimal system libraries. The `runtime`
# flavor adds CUDA libraries that the wheels already carry, and it is bigger
# on disk, which the image build can't spare on a hosted runner. Python 3.12 is
# installed by uv from .python-version.
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

COPY nfp_audio ./nfp_audio
COPY models ./models

CMD ["python", "-u", "-m", "nfp_audio"]
