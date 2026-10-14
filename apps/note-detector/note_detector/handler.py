"""One RunPod job: separate the vocals of a music WAV, find their notes and
compute their Pitch curve.

The steps are injected, so the job's contract is tested without the models,
the network or RunPod. `__main__` wires the real ones.
"""

import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from note_detector.contract import Upload, parse_input
from note_detector.notes import Note
from note_detector.pitch_curve import encode_pitch_curve

logger = logging.getLogger(__name__)

# The two stages the API shows while a Processing runs, reported to RunPod as
# progress updates. Their names are part of the contract.
EXTRACTING_VOCALS = "EXTRACTING_VOCALS"
DETECTING_NOTES = "DETECTING_NOTES"


@dataclass(frozen=True)
class Steps:
    download: Callable[[str, Path], None]
    extract_vocals: Callable[[Path, Path], None]
    upload: Callable[[Path, Upload], None]
    detect_notes: Callable[[Path], list[Note]]
    # One MIDI number per 10 ms frame of the vocals, 0 where nobody sings.
    pitch_curve: Callable[[Path], Iterable[float]]
    report_progress: Callable[[str], None]
    detector_version: str


def process(raw_input: object, steps: Steps) -> dict[str, object]:
    """Runs a job and returns its output.

    Any invalid input or failed step raises, the Pitch curve included: no
    Track completes without its Pitch curve.
    """
    job = parse_input(raw_input)
    logger.info("processing %s", job.processing_id)

    with TemporaryDirectory(prefix="note-detector-") as work_dir:
        music = Path(work_dir) / "music.wav"
        vocals = Path(work_dir) / "vocals.wav"
        curve = Path(work_dir) / "pitch-curve.bin"

        steps.report_progress(EXTRACTING_VOCALS)
        steps.download(job.music_url, music)
        steps.extract_vocals(music, vocals)
        steps.upload(vocals, job.vocals_upload)

        steps.report_progress(DETECTING_NOTES)
        notes = steps.detect_notes(vocals)
        curve.write_bytes(encode_pitch_curve(steps.pitch_curve(vocals)))
        steps.upload(curve, job.pitch_curve_upload)

    return {
        "vocalsUrl": job.vocals_upload.public_url,
        "pitchCurveUrl": job.pitch_curve_upload.public_url,
        "detectorVersion": steps.detector_version,
        "notes": [note.to_dict() for note in sorted(notes, key=_by_time)],
    }


def _by_time(note: Note) -> tuple[float, float]:
    return (note.start, note.end)
