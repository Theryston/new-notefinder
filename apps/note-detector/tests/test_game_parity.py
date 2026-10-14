"""Parity of our GAME loop with GAME's official `infer.py extract`.

Never runs in normal CI: it needs the ONNX release, a checkout of
openvpi/GAME at tag v1.0.3 with an environment that runs its `infer.py`, and
the matching PyTorch checkpoint. Point it at them with:

    NOTE_DETECTOR_GAME_DIR   the directory of the ONNX release files
    GAME_REPO                a checkout of https://github.com/openvpi/GAME at
                             tag v1.0.3
    GAME_PYTHON              the python of GAME's environment (its requirements)
    GAME_CHECKPOINT          GAME's `model.pt` of the same medium release
    GAME_FIXTURE             optional: a 44.1 kHz vocals WAV to use instead of
                             the synthesized melody

Both sides read the same input, so the fixture does not need to be a real
recording: by default a short sung-like melody is synthesized (held notes with
vibrato and harmonics, and a silence in the middle so there are two clips).

D3PM sampling is stochastic in both implementations (`rand_like` in GAME's
`remove_mutable_boundaries` is unseeded and runs inside the segmenter graph),
so the comparison has a tolerance: the number of notes within COUNT_SHARE (10%)
of the official one, at least MATCHED_SHARE (90%) of the official notes matched
one-to-one by onset and offset within 50 ms, and matched pitches within half a
semitone.
"""

import csv
import importlib.util
import os
import subprocess
from pathlib import Path

import numpy as np
import pytest

from note_detector.notes import Note

pytestmark = pytest.mark.parity

GAME_TAG = "v1.0.3"
SAMPLE_RATE = 44100
ONSET_TOLERANCE = 0.05
PITCH_TOLERANCE = 0.5
MATCHED_SHARE = 0.9
COUNT_SHARE = 0.1
# (MIDI pitch, seconds) of the synthesized melody; None is a silence.
MELODY = [(57, 0.7), (60, 0.7), (64, 0.9), (62, 0.6), (None, 1.0), (60, 0.8)]
MELODY += [(65, 0.7), (64, 1.0)]


def _env_path(name: str) -> Path | None:
    value = os.environ.get(name)
    return Path(value) if value else None


GAME_DIR = _env_path("NOTE_DETECTOR_GAME_DIR")
GAME_REPO = _env_path("GAME_REPO")
GAME_PYTHON = os.environ.get("GAME_PYTHON")
CHECKPOINT = _env_path("GAME_CHECKPOINT")
FIXTURE = _env_path("GAME_FIXTURE")


def _available(*paths: Path | str | None) -> bool:
    return all(p is not None and Path(p).exists() for p in paths)


def _voice(midi: int, seconds: float) -> np.ndarray:
    """A held note: 5.5 Hz vibrato of +-0.3 semitone, six harmonics."""
    t = np.arange(round(seconds * SAMPLE_RATE)) / SAMPLE_RATE
    semitones = midi + 0.3 * np.sin(2 * np.pi * 5.5 * t)
    frequency = 440.0 * 2 ** ((semitones - 69) / 12)
    phase = 2 * np.pi * np.cumsum(frequency) / SAMPLE_RATE
    wave = sum(np.sin(k * phase) / k for k in range(1, 7))
    envelope = np.minimum(1.0, np.minimum(t, seconds - t) / 0.05)
    return (0.3 * wave * envelope).astype(np.float32)


def _synthesize(path: Path) -> Path:
    import soundfile as sf

    parts = [
        np.zeros(round(seconds * SAMPLE_RATE), dtype=np.float32)
        if midi is None
        else _voice(midi, seconds)
        for midi, seconds in MELODY
    ]
    sf.write(path, np.concatenate(parts), SAMPLE_RATE)
    return path


def _checkout_tag() -> str:
    result = subprocess.run(
        ["git", "describe", "--tags", "--exact-match", "HEAD"],
        cwd=GAME_REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.strip()


def _official_notes(fixture: Path, out_dir: Path) -> list[Note]:
    """What `infer.py extract` finds, with GAME's defaults.

    One clip per batch, as ours: a larger batch zero-pads the clips to the
    longest one, which changes the frames at their edges.
    """
    subprocess.run(
        [
            GAME_PYTHON,
            "infer.py",
            "extract",
            str(fixture),
            "-m",
            str(CHECKPOINT),
            "--batch-size",
            "1",
            "--output-formats",
            "csv",
            "--pitch-format",
            "number",
            "--output-dir",
            str(out_dir),
        ],
        cwd=GAME_REPO,
        check=True,
    )
    with (out_dir / fixture.with_suffix(".csv").name).open() as file:
        return [
            Note(float(r["pitch"]), float(r["onset"]), float(r["offset"]))
            for r in csv.DictReader(file)
        ]


def _match_one_to_one(
    official: list[Note], ours: list[Note]
) -> list[tuple[Note, Note]]:
    """Pairs each official note with a still unused note of ours, in place."""
    free = list(ours)
    pairs = []
    for reference in official:
        for note in free:
            same_onset = abs(note.start - reference.start) <= ONSET_TOLERANCE
            same_offset = abs(note.end - reference.end) <= ONSET_TOLERANCE
            if same_onset and same_offset:
                pairs.append((reference, note))
                free.remove(note)
                break
    return pairs


@pytest.mark.skipif(
    not _available(GAME_DIR, GAME_REPO, GAME_PYTHON, CHECKPOINT),
    reason="needs the GAME ONNX release, its repo and its checkpoint",
)
def test_our_loop_finds_the_notes_of_games_infer(tmp_path):
    from note_detector.game import GameOnnx, notes_in_file

    assert _checkout_tag() == GAME_TAG, f"GAME_REPO must be at {GAME_TAG}"
    fixture = FIXTURE or _synthesize(tmp_path / "melody.wav")

    official = _official_notes(fixture, tmp_path)
    ours = notes_in_file(fixture, GameOnnx(GAME_DIR))

    assert official, "the fixture has no voice for GAME to find"
    assert abs(len(ours) - len(official)) <= max(1, COUNT_SHARE * len(official))
    pairs = _match_one_to_one(official, ours)
    assert len(pairs) >= MATCHED_SHARE * len(official)
    for reference, note in pairs:
        assert abs(note.pitch - reference.pitch) <= PITCH_TOLERANCE


@pytest.mark.skipif(
    not _available(GAME_REPO), reason="needs a checkout of openvpi/GAME"
)
def test_our_slicer_cuts_like_games():
    from note_detector.game_slicer import slice_vocals

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
        ours = slice_vocals(wave, SAMPLE_RATE)

        assert [c["offset"] for c in expected] == [c.offset for c in ours]
        for theirs, mine in zip(expected, ours, strict=True):
            np.testing.assert_array_equal(theirs["waveform"], mine.waveform)


def test_two_official_notes_never_match_the_same_note_of_ours():
    official = [Note(60, 0.0, 1.0), Note(60, 0.01, 1.01)]
    ours = [Note(60, 0.0, 1.0)]

    assert _match_one_to_one(official, ours) == [(official[0], ours[0])]


def test_a_note_off_by_more_than_the_tolerance_does_not_match():
    official = [Note(60, 0.0, 1.0)]

    assert _match_one_to_one(official, [Note(60, 0.0, 1.1)]) == []
    assert _match_one_to_one(official, [Note(60, 0.1, 1.0)]) == []


def test_the_synthesized_voice_is_audible_and_as_long_as_asked():
    voice = _voice(60, 0.5)

    assert len(voice) == SAMPLE_RATE // 2
    assert 0.1 < float(np.abs(voice).max()) <= 1.0
