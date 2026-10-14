"""Parity of our GAME loop with GAME's official `infer.py extract`.

Never runs in normal CI: it needs the ONNX release, a checkout of
openvpi/GAME with an environment that runs its `infer.py`, the matching
PyTorch checkpoint and a short vocals fixture. Point it at them with:

    NOTE_DETECTOR_GAME_DIR   the directory of the ONNX release files
    GAME_REPO                a checkout of https://github.com/openvpi/GAME
    GAME_PYTHON              the python of GAME's environment (its requirements)
    GAME_CHECKPOINT          GAME's `model.pt` of the same medium release
    GAME_FIXTURE             a short 44.1 kHz vocals WAV (defaults to
                             tests/fixtures/vocals-short.wav)

D3PM sampling is stochastic in both implementations (the segmenter removes
random boundaries at each step), so the comparison has a tolerance: the same
number of notes within a few percent, boundaries within 50 ms and pitches
within half a semitone.
"""

import csv
import importlib.util
import os
import subprocess
from pathlib import Path

import pytest

from note_detector.notes import Note

pytestmark = pytest.mark.parity

ONSET_TOLERANCE = 0.05
PITCH_TOLERANCE = 0.5
MATCHED_SHARE = 0.9
COUNT_SHARE = 0.1
DEFAULT_FIXTURE = Path(__file__).parent / "fixtures" / "vocals-short.wav"


def _env_path(name: str) -> Path | None:
    value = os.environ.get(name)
    return Path(value) if value else None


GAME_DIR = _env_path("NOTE_DETECTOR_GAME_DIR")
GAME_REPO = _env_path("GAME_REPO")
GAME_PYTHON = os.environ.get("GAME_PYTHON")
CHECKPOINT = _env_path("GAME_CHECKPOINT")
FIXTURE = _env_path("GAME_FIXTURE") or DEFAULT_FIXTURE


def _available(*paths: Path | str | None) -> bool:
    return all(p is not None and Path(p).exists() for p in paths)


def _official_notes(tmp_path: Path) -> list[Note]:
    """What `infer.py extract` finds, with GAME's defaults."""
    subprocess.run(
        [
            GAME_PYTHON,
            "infer.py",
            "extract",
            str(FIXTURE),
            "-m",
            str(CHECKPOINT),
            "--output-formats",
            "csv",
            "--pitch-format",
            "number",
            "--output-dir",
            str(tmp_path),
        ],
        cwd=GAME_REPO,
        check=True,
    )
    with (tmp_path / FIXTURE.with_suffix(".csv").name).open() as file:
        return [
            Note(float(r["pitch"]), float(r["onset"]), float(r["offset"]))
            for r in csv.DictReader(file)
        ]


def _matches(reference: Note, ours: list[Note]) -> Note | None:
    for note in ours:
        if abs(note.start - reference.start) <= ONSET_TOLERANCE and (
            abs(note.end - reference.end) <= ONSET_TOLERANCE
        ):
            return note
    return None


@pytest.mark.skipif(
    not _available(GAME_DIR, GAME_REPO, GAME_PYTHON, CHECKPOINT, FIXTURE),
    reason="needs the GAME ONNX release, its repo and checkpoint, a fixture",
)
def test_our_loop_finds_the_notes_of_gamess_infer(tmp_path):
    from note_detector.game import find_notes

    official = _official_notes(tmp_path)
    ours = find_notes(FIXTURE)

    assert official, "the fixture has no voice for GAME to find"
    assert abs(len(ours) - len(official)) <= max(1, COUNT_SHARE * len(official))
    pairs = [(r, _matches(r, ours)) for r in official]
    matched = [(r, m) for r, m in pairs if m is not None]
    assert len(matched) >= MATCHED_SHARE * len(official)
    for reference, note in matched:
        assert abs(note.pitch - reference.pitch) <= PITCH_TOLERANCE


@pytest.mark.skipif(
    not _available(GAME_REPO), reason="needs a checkout of openvpi/GAME"
)
def test_our_slicer_cuts_like_gamess():
    import numpy as np

    from note_detector.game_slicer import SAMPLE_RATE, slice_vocals

    path = GAME_REPO / "inference" / "slicer2.py"
    spec = importlib.util.spec_from_file_location("game_slicer2", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    reference = module.Slicer(
        sr=SAMPLE_RATE,
        threshold=-40.0,
        min_length=1000,
        min_interval=200,
        max_sil_kept=100,
    )
    rng = np.random.default_rng(0)
    for _ in range(50):
        parts = [
            (
                rng.standard_normal(int(rng.uniform(0.05, 2.5) * SAMPLE_RATE))
                * rng.choice([0.0, 0.003, 0.05, 0.3])
            ).astype(np.float32)
            for _ in range(rng.integers(1, 12))
        ]
        wave = np.concatenate(parts)

        expected = [c for c in reference.slice(wave) if len(c["waveform"])]
        ours = slice_vocals(wave)

        assert [c["offset"] for c in expected] == [c.offset for c in ours]
        for theirs, mine in zip(expected, ours, strict=True):
            np.testing.assert_array_equal(theirs["waveform"], mine.waveform)
