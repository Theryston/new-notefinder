# The RunPod serverless image. Built from this directory as the context (see
# .dockerignore), published to GHCR by .github/workflows/nfp-audio-image.yml.
#
# CUDA 12.6 is the runtime the legacy worker was built on: the torch and
# TensorFlow CUDA libraries come from the PyPI wheels pinned in pyproject.toml,
# so the base only supplies the NVIDIA driver interface and the system
# libraries. Python 3.12 is installed by uv from .python-version.
FROM nvidia/cuda:12.6.0-runtime-ubuntu22.04

COPY --from=ghcr.io/astral-sh/uv:0.11.32 /uv /usr/local/bin/uv

ENV UV_PYTHON_INSTALL_DIR=/opt/python \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR /app

# The dependencies come first, so a change to the code does not reinstall
# the CUDA stack. `--locked` fails the build when uv.lock is out of date.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev --group model

COPY nfp_audio ./nfp_audio
COPY models ./models

CMD ["python", "-u", "-m", "nfp_audio"]
