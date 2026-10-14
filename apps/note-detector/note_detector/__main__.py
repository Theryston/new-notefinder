"""RunPod serverless entrypoint: `python -m note_detector` in the GPU image.

The model steps not wired yet fail the job loudly until their adapter lands,
so a half-built image can never complete a Processing.
"""

import logging
import os
from functools import lru_cache
from pathlib import Path

import runpod

from note_detector.handler import Steps, process
from note_detector.notes import Note
from note_detector.rmvpe import load_rmvpe, pitch_curve
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


def detect_notes(vocals: Path) -> list[Note]:
    raise _not_wired("Vocal notes")


def run_job(job: dict[str, object]) -> dict[str, object]:
    steps = Steps(
        download=download,
        extract_vocals=separate_vocals,
        upload=upload,
        detect_notes=detect_notes,
        pitch_curve=pitch_curve,
        report_progress=lambda stage: runpod.serverless.progress_update(
            job, stage
        ),
        detector_version=detector_version(os.environ),
    )
    return process(job.get("input"), steps)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    # Load the models before the first job, so it does not pay for it.
    load_rmvpe()
    separator()
    runpod.serverless.start({"handler": run_job})


if __name__ == "__main__":
    main()
