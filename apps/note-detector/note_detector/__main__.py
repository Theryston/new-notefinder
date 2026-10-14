"""RunPod serverless entrypoint: `python -m note_detector` in the GPU image."""

import logging
import os
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from note_detector.contract import Upload
from note_detector.handler import Steps, process
from note_detector.notes import Note
from note_detector.startup import require_gpu, reuse_model
from note_detector.version import detector_version

Handler = Callable[[dict[str, object]], dict[str, object]]


@dataclass(frozen=True)
class WorkerAdapters:
    """Model factories and job adapters, injectable at the worker seam."""

    cuda_available: Callable[[], bool]
    create_game: Callable[[], object]
    separator: Callable[[], object]
    load_rmvpe: Callable[[], object]
    extract_vocals: Callable[[object, Path, Path], None]
    detect_notes: Callable[[Path, object], list[Note]]
    pitch_curve: Callable[[Path, object], Iterable[float]]
    download: Callable[[str, Path], None]
    upload: Callable[[Path, Upload], None]
    start: Callable[[Handler], None]
    progress_update: Callable[[dict[str, object], str], None]


@dataclass(frozen=True)
class WorkerModels:
    game: object
    pitch_curve_step: Callable[[Path], Iterable[float]]


@lru_cache(maxsize=1)
def separator() -> object:
    """Loaded once per worker process and reused by every job."""
    return _load_separator()


def _load_separator() -> object:
    from note_detector.separation import load_separator
    from note_detector.separation_config import separation_directory

    return load_separator(separation_directory(os.environ))


def _production_adapters() -> WorkerAdapters:
    import runpod
    import torch

    from note_detector.game import GameOnnx, notes_in_file
    from note_detector.game_io import game_directory
    from note_detector.rmvpe import load_rmvpe, pitch_curve_with_model
    from note_detector.separation import extract_vocals
    from note_detector.transfer import download, upload

    return WorkerAdapters(
        cuda_available=torch.cuda.is_available,
        create_game=lambda: GameOnnx(game_directory(os.environ)),
        separator=separator,
        load_rmvpe=load_rmvpe,
        extract_vocals=extract_vocals,
        detect_notes=notes_in_file,
        pitch_curve=pitch_curve_with_model,
        download=download,
        upload=upload,
        start=lambda handler: runpod.serverless.start({"handler": handler}),
        progress_update=runpod.serverless.progress_update,
    )


def load_worker_models(adapters: WorkerAdapters) -> WorkerModels:
    try:
        require_gpu(adapters.cuda_available())
    except RuntimeError as error:
        raise SystemExit(str(error)) from None

    game = adapters.create_game()
    adapters.separator()
    pitch_curve_step = reuse_model(adapters.load_rmvpe(), adapters.pitch_curve)
    return WorkerModels(game, pitch_curve_step)


def steps_for_job(
    adapters: WorkerAdapters,
    models: WorkerModels,
    job: dict[str, object],
) -> Steps:
    """Wires the real steps, reusing the models loaded before RunPod starts."""
    return Steps(
        download=adapters.download,
        extract_vocals=lambda music, vocals: adapters.extract_vocals(
            adapters.separator(), music, vocals
        ),
        upload=adapters.upload,
        detect_notes=lambda vocals: adapters.detect_notes(vocals, models.game),
        pitch_curve=models.pitch_curve_step,
        report_progress=lambda stage: adapters.progress_update(job, stage),
        detector_version=detector_version(os.environ),
    )


def main(adapters: WorkerAdapters | None = None) -> None:
    logging.basicConfig(level=logging.INFO)
    worker_adapters = adapters or _production_adapters()
    models = load_worker_models(worker_adapters)

    def handler(job: dict[str, object]) -> dict[str, object]:
        steps = steps_for_job(worker_adapters, models, job)
        return process(job.get("input"), steps)

    worker_adapters.start(handler)


if __name__ == "__main__":
    main()
