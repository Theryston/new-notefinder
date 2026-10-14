"""RunPod serverless entrypoint: `python -m note_detector` in the GPU image.

The three model steps are not wired yet: each fails the job loudly until its
adapter lands, so a half-built image can never complete a Processing.
"""

import logging
import os
from pathlib import Path

import runpod

from note_detector.game import GameOnnx, notes_in_file
from note_detector.game_io import game_directory
from note_detector.handler import Steps, process
from note_detector.transfer import download, upload
from note_detector.version import detector_version


def _not_wired(step: str) -> RuntimeError:
    return RuntimeError(f"the {step} step has no model wired yet")


def extract_vocals(music: Path, vocals: Path) -> None:
    raise _not_wired("vocal separation")


def pitch_curve(vocals: Path) -> list[float]:
    raise _not_wired("Pitch curve")


def run_job(job: dict[str, object], game: GameOnnx) -> dict[str, object]:
    steps = Steps(
        download=download,
        extract_vocals=extract_vocals,
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
    runpod.serverless.start({"handler": lambda job: run_job(job, game)})


if __name__ == "__main__":
    main()
