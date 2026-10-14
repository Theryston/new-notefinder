"""RunPod serverless entrypoint: `python -m note_detector` in the GPU image.

Wires vocal separation, Vocal notes and the Pitch curve. Each model is
loaded once at startup and reused by every job.
"""

import logging
import os
from collections.abc import Callable, Iterable
from functools import lru_cache
from pathlib import Path

import runpod

from note_detector.game import GameOnnx, notes_in_file
from note_detector.game_io import game_directory
from note_detector.handler import Steps, process
from note_detector.rmvpe import load_rmvpe, pitch_curve_with_model
from note_detector.separation import Separator, extract_vocals, load_separator
from note_detector.separation_config import separation_directory
from note_detector.startup import require_gpu, reuse_model
from note_detector.transfer import download, upload
from note_detector.version import detector_version


@lru_cache(maxsize=1)
def separator() -> Separator:
    """Loaded once per worker process and reused by every job."""
    return load_separator(separation_directory(os.environ))


def separate_vocals(music: Path, vocals: Path) -> None:
    extract_vocals(separator(), music, vocals)


def run_job(
    job: dict[str, object],
    game: GameOnnx,
    pitch_curve_step: Callable[[Path], Iterable[float]],
) -> dict[str, object]:
    steps = steps_for_job(
        game,
        pitch_curve_step,
        lambda stage: runpod.serverless.progress_update(job, stage),
    )
    return process(job.get("input"), steps)


def steps_for_job(
    game: GameOnnx,
    pitch_curve_step: Callable[[Path], Iterable[float]],
    report_progress: Callable[[str], None],
) -> Steps:
    """Wires the real pipeline steps shared by RunPod and the image smoke."""
    steps = Steps(
        download=download,
        extract_vocals=separate_vocals,
        upload=upload,
        detect_notes=lambda vocals: notes_in_file(vocals, game),
        pitch_curve=pitch_curve_step,
        report_progress=report_progress,
        detector_version=detector_version(os.environ),
    )
    return steps


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    import torch

    try:
        require_gpu(torch.cuda.is_available())
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    # The ONNX sessions are created once per worker, before the first job.
    game = GameOnnx(game_directory(os.environ))
    # Load the model at startup so the first job does not pay for it.
    separator()
    pitch_curve_step = reuse_model(load_rmvpe(), pitch_curve_with_model)
    runpod.serverless.start(
        {
            "handler": lambda job: run_job(
                job,
                game,
                pitch_curve_step,
            )
        }
    )


if __name__ == "__main__":
    main()
