"""RunPod serverless entrypoint: `python -m note_detector` in the GPU image.

A model step that is not wired yet fails the job loudly until its adapter
lands, so a half-built image can never complete a Processing.
"""

import logging
import os
from functools import lru_cache
from pathlib import Path

import runpod

from note_detector.game import GameOnnx, notes_in_file
from note_detector.game_io import game_directory
from note_detector.handler import Steps, process
from note_detector.separation import Separator, extract_vocals, load_separator
from note_detector.separation_config import separation_directory
from note_detector.transfer import download, upload
from note_detector.version import detector_version


def _not_wired(step: str) -> RuntimeError:
    return RuntimeError(f"the {step} step has no model wired yet")


@lru_cache(maxsize=1)
def separator() -> Separator:
    """Loaded once per worker process and reused by every job."""
    return load_separator(separation_directory(os.environ))


def separate_vocals(music: Path, vocals: Path) -> None:
    extract_vocals(separator(), music, vocals)


def pitch_curve(vocals: Path) -> list[float]:
    raise _not_wired("Pitch curve")


def run_job(job: dict[str, object], game: GameOnnx) -> dict[str, object]:
    steps = Steps(
        download=download,
        extract_vocals=separate_vocals,
        upload=upload,
        detect_notes=lambda vocals: notes_in_file(vocals, game),
        pitch_curve=pitch_curve,
        report_progress=lambda stage: runpod.serverless.progress_update(
            job, stage
        ),
        detector_version=detector_version(os.environ),
    )
    return process(job.get("input"), steps)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    # The ONNX sessions are created once per worker, before the first job.
    game = GameOnnx(game_directory(os.environ))
    # Load the model at startup so the first job does not pay for it.
    separator()
    runpod.serverless.start({"handler": lambda job: run_job(job, game)})


if __name__ == "__main__":
    main()
