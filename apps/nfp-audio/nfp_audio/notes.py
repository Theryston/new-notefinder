"""Turns CREPE's frame-by-frame pitch into the notes a singer hits.

Pure functions over numpy arrays, so they run without the model stack. The
thresholds and the grouping rules are the legacy worker's: a Track's notes
must come out the same as they did before the worker moved into the
monorepo.
"""

from collections.abc import Sequence
from dataclasses import dataclass, replace

import numpy as np
from numpy.typing import NDArray

# Frames below this CREPE confidence break a note.
CONFIDENCE_THRESHOLD = 0.85
# Notes shorter than this (seconds) are dropped as noise.
MIN_NOTE_DURATION = 0.05
# Two notes of the same pitch closer than this (seconds) are one note.
MERGE_MAX_GAP = 0.2

A4_HZ = 440.0
NOTE_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")


@dataclass(frozen=True)
class Note:
    note: str
    octave: int
    start: float
    end: float
    frequency_mean: float

    def to_dict(self) -> dict[str, str | int | float]:
        # camelCase on the wire, like every other field the API reads (the
        # maintainer's decision: the issue text said frequency_mean).
        return {
            "note": self.note,
            "octave": self.octave,
            "start": self.start,
            "end": self.end,
            "frequencyMean": self.frequency_mean,
        }


def freq_to_note(freq_hz: float) -> tuple[str, int] | None:
    """The note name and MIDI octave of a frequency, None when it has none."""
    if not np.isfinite(freq_hz) or freq_hz <= 0:
        return None

    midi_number = int(round(69 + 12 * np.log2(freq_hz / A4_HZ)))
    return NOTE_NAMES[midi_number % 12], midi_number // 12 - 1


def group_notes(
    time: NDArray[np.float64],
    frequency: NDArray[np.float64],
    confidence: NDArray[np.float64],
    confidence_threshold: float,
) -> list[Note]:
    """Groups consecutive frames of the same pitch into notes.

    A frame that is unvoiced (under the confidence threshold) or has no pitch
    ends the note in progress, so the same pitch on either side of a gap
    becomes two notes.
    """
    notes: list[Note] = []
    label: tuple[str, int] | None = None
    run: list[int] = []

    for index in range(len(frequency)):
        frame_label = _frame_label(
            frequency[index], confidence[index], confidence_threshold
        )
        if frame_label != label:
            if label is not None:
                notes.append(_note_from_run(label, time, frequency, run))
            label, run = frame_label, []
        if label is not None:
            run.append(index)

    if label is not None:
        notes.append(_note_from_run(label, time, frequency, run))
    return notes


def filter_short_notes(notes: list[Note], min_duration: float) -> list[Note]:
    return [note for note in notes if note.end - note.start >= min_duration]


def merge_close_notes(notes: list[Note], max_gap: float) -> list[Note]:
    """Joins consecutive notes of the same pitch separated by a small gap.

    The merged frequency is the running average of the two, as the legacy
    worker computed it (not weighted by duration).
    """
    if not notes:
        return []

    merged = [notes[0]]
    for current in notes[1:]:
        last = merged[-1]
        same_pitch = (current.note, current.octave) == (last.note, last.octave)
        gap = current.start - last.end
        if same_pitch and gap <= max_gap:
            merged[-1] = replace(
                last,
                end=current.end,
                frequency_mean=float(
                    np.mean([last.frequency_mean, current.frequency_mean])
                ),
            )
        else:
            merged.append(current)
    return merged


def notes_from_frames(
    time: NDArray[np.float64],
    frequency: NDArray[np.float64],
    confidence: NDArray[np.float64],
) -> list[Note]:
    """The full pipeline from CREPE frames to the notes the API stores."""
    grouped = group_notes(time, frequency, confidence, CONFIDENCE_THRESHOLD)
    long_enough = filter_short_notes(grouped, MIN_NOTE_DURATION)
    return merge_close_notes(long_enough, MERGE_MAX_GAP)


def _frame_label(
    frequency: float, confidence: float, confidence_threshold: float
) -> tuple[str, int] | None:
    if confidence < confidence_threshold:
        return None
    return freq_to_note(float(frequency))


def _note_from_run(
    label: tuple[str, int],
    time: Sequence[float] | NDArray[np.float64],
    frequency: Sequence[float] | NDArray[np.float64],
    run: Sequence[int],
) -> Note:
    note, octave = label
    return Note(
        note=note,
        octave=octave,
        start=float(time[run[0]]),
        end=float(time[run[-1]]),
        frequency_mean=float(np.mean([frequency[i] for i in run])),
    )
