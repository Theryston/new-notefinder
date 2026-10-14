"""Startup checks for the GPU-only RunPod worker."""

from collections.abc import Callable


def require_gpu(cuda_available: bool) -> None:
    """Fail before loading gigabytes of model weights when CUDA is absent."""
    if not cuda_available:
        raise RuntimeError(
            "note-detector requires a CUDA GPU; use a RunPod A40 or RTX A6000"
        )


def reuse_model[Input, Model, Output](
    model: Model, inference: Callable[[Input, Model], Output]
) -> Callable[[Input], Output]:
    """Bind one startup-loaded model for reuse by every worker job."""

    def run(value: Input) -> Output:
        return inference(value, model)

    return run
