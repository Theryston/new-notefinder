import numpy as np
import pytest

from nfp_audio.notes import (
    Note,
    filter_short_notes,
    freq_to_note,
    group_notes,
    merge_close_notes,
    notes_from_frames,
)


def segment(start: float, count: int, frequency: float, confidence=0.95):
    """`count` CREPE frames, 10 ms apart, from `start` seconds."""
    time = np.round(start + 0.01 * np.arange(count), 2)
    return time, np.full(count, frequency), np.full(count, confidence)


def frames(*segments):
    times, frequencies, confidences = zip(*segments, strict=True)
    return (
        np.concatenate(times),
        np.concatenate(frequencies),
        np.concatenate(confidences),
    )


def note(name: str, octave: int, start: float, end: float, freq: float):
    return Note(name, octave, start, end, freq)


class TestFreqToNote:
    @pytest.mark.parametrize(
        ("frequency", "expected"),
        [
            (440.0, ("A", 4)),
            (261.63, ("C", 4)),
            (493.88, ("B", 4)),
            (523.25, ("C", 5)),
        ],
    )
    def test_names_the_note_and_its_octave(self, frequency, expected):
        assert freq_to_note(frequency) == expected

    @pytest.mark.parametrize(
        "frequency", [0.0, -1.0, float("nan"), float("inf")]
    )
    def test_has_no_note_without_a_pitch(self, frequency):
        assert freq_to_note(frequency) is None


class TestGroupNotes:
    def test_groups_consecutive_frames_of_one_pitch(self):
        time, freq, conf = frames(segment(0.0, 4, 440.0))

        notes = group_notes(time, freq, conf, confidence_threshold=0.85)

        assert notes == [note("A", 4, 0.0, 0.03, 440.0)]

    def test_splits_when_the_pitch_changes(self):
        time, freq, conf = frames(
            segment(0.0, 2, 440.0), segment(0.02, 2, 261.63)
        )

        notes = group_notes(time, freq, conf, confidence_threshold=0.85)

        assert [(n.note, n.octave) for n in notes] == [("A", 4), ("C", 4)]
        assert notes[1].start == pytest.approx(0.02)

    def test_an_unvoiced_frame_breaks_a_note(self):
        time, freq, conf = frames(
            segment(0.0, 1, 440.0),
            segment(0.01, 1, 440.0, confidence=0.1),
            segment(0.02, 1, 440.0),
        )

        notes = group_notes(time, freq, conf, confidence_threshold=0.85)

        assert [n.start for n in notes] == [0.0, 0.02]

    def test_a_frame_without_pitch_breaks_a_note(self):
        time, freq, conf = frames(
            segment(0.0, 1, 440.0),
            segment(0.01, 1, 0.0),
            segment(0.02, 1, 440.0),
        )

        notes = group_notes(time, freq, conf, confidence_threshold=0.85)

        assert len(notes) == 2

    def test_the_frequency_of_a_note_is_the_mean_of_its_frames(self):
        time, freq, conf = frames(
            segment(0.0, 1, 430.0), segment(0.01, 1, 450.0)
        )

        notes = group_notes(time, freq, conf, confidence_threshold=0.85)

        assert notes[0].frequency_mean == pytest.approx(440.0)

    def test_no_voiced_frames_means_no_notes(self):
        time, freq, conf = frames(segment(0.0, 3, 440.0, confidence=0.2))

        assert group_notes(time, freq, conf, confidence_threshold=0.85) == []


class TestFilterShortNotes:
    def test_drops_notes_shorter_than_the_minimum(self):
        notes = [note("A", 4, 0.0, 0.04, 440.0), note("A", 4, 2.0, 2.5, 440.0)]

        assert filter_short_notes(notes, min_duration=0.05) == [notes[1]]


class TestMergeCloseNotes:
    def test_joins_the_same_pitch_across_a_small_gap(self):
        notes = [note("A", 4, 0.0, 0.5, 440.0), note("A", 4, 0.6, 1.0, 450.0)]

        merged = merge_close_notes(notes, max_gap=0.2)

        assert merged == [note("A", 4, 0.0, 1.0, 445.0)]

    def test_keeps_the_same_pitch_apart_across_a_large_gap(self):
        notes = [note("A", 4, 0.0, 0.5, 440.0), note("A", 4, 1.0, 1.5, 440.0)]

        assert merge_close_notes(notes, max_gap=0.2) == notes

    def test_never_joins_different_pitches(self):
        notes = [note("A", 4, 0.0, 0.5, 440.0), note("C", 4, 0.5, 1.0, 261.63)]

        assert merge_close_notes(notes, max_gap=0.2) == notes

    def test_no_notes_stay_no_notes(self):
        assert merge_close_notes([], max_gap=0.2) == []


class TestNotesFromFrames:
    def test_detects_the_notes_sung_and_drops_the_noise(self):
        time, freq, conf = frames(
            segment(0.0, 31, 440.0),
            segment(0.31, 6, 440.0, confidence=0.1),
            segment(0.37, 25, 261.63),
            segment(1.0, 2, 493.88),
        )

        notes = notes_from_frames(time, freq, conf)

        assert [(n.note, n.octave) for n in notes] == [("A", 4), ("C", 4)]
        assert notes[0].start == pytest.approx(0.0)
        assert notes[0].end == pytest.approx(0.30)
        assert notes[1].start == pytest.approx(0.37)
        assert notes[1].end == pytest.approx(0.61)
