import numpy as np
import pytest

from note_detector.game_decode import d3pm_times
from note_detector.game_pipeline import Encoded, notes_in_waveform
from note_detector.notes import Note

SAMPLE_RATE = 44100
TIMESTEP = 0.01


def tone(seconds: float) -> np.ndarray:
    t = np.arange(round(seconds * SAMPLE_RATE)) / SAMPLE_RATE
    return (0.5 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


class FakeGame:
    """A GAME that cuts every clip in halves, the second one unvoiced or not."""

    sample_rate = SAMPLE_RATE
    timestep = TIMESTEP

    def __init__(self, voiced=(True, True)):
        self.voiced = voiced
        self.encoded_durations: list[float] = []
        self.segment_calls: list[tuple[float, bool]] = []

    def encode(self, waveform, duration):
        self.encoded_durations.append(duration)
        frames = round(duration / TIMESTEP)
        zeros = np.zeros((1, frames, 2), dtype=np.float32)
        return Encoded(zeros, zeros, np.ones((1, frames), dtype=bool))

    def segment(self, encoded, known, previous, t):
        self.segment_calls.append((t, bool(previous.any())))
        boundaries = np.zeros_like(known)
        boundaries[0, encoded.mask.shape[1] // 2] = True
        return boundaries

    def estimate(self, encoded, boundaries):
        assert boundaries.sum() == 1
        return np.array(self.voiced), np.array([60.5, 64.0])


def test_a_single_clip_gives_its_voiced_regions_as_notes():
    game = FakeGame()

    notes = notes_in_waveform(tone(2.0), game)

    assert notes == [Note(60.5, 0.0, 1.0), Note(64.0, 1.0, 2.0)]


def test_the_encoder_gets_the_clip_duration():
    game = FakeGame()

    notes_in_waveform(tone(2.0), game)

    assert game.encoded_durations == [pytest.approx(2.0)]


def test_the_segmenter_runs_every_d3pm_step_from_no_known_boundary():
    game = FakeGame()

    notes_in_waveform(tone(2.0), game)

    assert [t for t, _ in game.segment_calls] == d3pm_times()
    # The first pass starts from nothing, the next ones from the last pass.
    assert [had for _, had in game.segment_calls] == [False] + [True] * 7


def test_unvoiced_regions_are_dropped():
    game = FakeGame(voiced=(True, False))

    assert notes_in_waveform(tone(2.0), game) == [Note(60.5, 0.0, 1.0)]


def test_clips_after_a_silence_are_offset_by_where_they_start():
    wave = np.concatenate(
        [tone(2.0), np.zeros(SAMPLE_RATE, dtype=np.float32), tone(2.0)]
    )
    game = FakeGame()

    notes = notes_in_waveform(wave, game)

    assert len(game.encoded_durations) == 2
    assert [n.start for n in notes] == sorted(n.start for n in notes)
    assert len(notes) == 4
    assert notes[2].start == pytest.approx(
        game.encoded_durations[0] + 0.9, abs=0.2
    )
    assert notes[-1].end == pytest.approx(5.0, abs=0.1)


def test_silence_only_vocals_have_no_notes():
    game = FakeGame()

    assert (
        notes_in_waveform(np.zeros(3 * SAMPLE_RATE, dtype=np.float32), game)
        == []
    )
    assert game.encoded_durations == []
