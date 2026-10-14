import pytest

from note_detector.startup import require_gpu, reuse_model


def test_worker_startup_accepts_cuda():
    require_gpu(True)


def test_worker_startup_fails_clearly_without_cuda():
    with pytest.raises(
        RuntimeError,
        match=(
            "note-detector requires a CUDA GPU; use a RunPod A40 or RTX A6000"
        ),
    ):
        require_gpu(False)


def test_warm_jobs_reuse_the_model_loaded_at_startup():
    model = object()
    load_count = 0
    seen_models: list[object] = []

    def load_model() -> object:
        nonlocal load_count
        load_count += 1
        return model

    def infer(value: str, loaded_model: object) -> str:
        seen_models.append(loaded_model)
        return f"{value}:{id(loaded_model)}"

    step = reuse_model(load_model(), infer)

    assert step("first") == f"first:{id(model)}"
    assert step("second") == f"second:{id(model)}"
    assert seen_models == [model, model]
    assert load_count == 1
