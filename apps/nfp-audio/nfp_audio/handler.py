"""One RunPod job: separate the vocals of a music WAV and detect their notes.

The steps are injected, so the job's contract is tested without the models,
the network or RunPod. `__main__` wires the real ones.
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from nfp_audio.contract import VocalsUpload, parse_input
from nfp_audio.notes import Note

logger = logging.getLogger(__name__)

# The two stages the API shows while a Processing runs, reported to RunPod as
# progress updates. Their names are part of the contract.
EXTRACTING_VOCALS = "EXTRACTING_VOCALS"
DETECTING_NOTES = "DETECTING_NOTES"


@dataclass(frozen=True)
class Steps:
    download: Callable[[str, Path], None]
    extract_vocals: Callable[[Path, Path], None]
    upload: Callable[[Path, VocalsUpload], None]
    detect_notes: Callable[[Path], list[Note]]
    report_progress: Callable[[str], None]


def process(raw_input: object, steps: Steps) -> dict[str, object]:
    """Runs a job and returns its output: the vocals URL and the notes."""
    job = parse_input(raw_input)
    logger.info("processing %s", job.processing_id)

    with TemporaryDirectory(prefix="nfp-audio-") as work_dir:
        music = Path(work_dir) / "music.wav"
        vocals = Path(work_dir) / "vocals.wav"

        steps.report_progress(EXTRACTING_VOCALS)
        steps.download(job.music_url, music)
        steps.extract_vocals(music, vocals)
        steps.upload(vocals, job.vocals_upload)

        steps.report_progress(DETECTING_NOTES)
        notes = steps.detect_notes(vocals)

    return {
        "vocalsUrl": job.vocals_upload.public_url,
        "notes": [note.to_dict() for note in notes],
    }
