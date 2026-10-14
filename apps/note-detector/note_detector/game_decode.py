"""The pure steps around GAME's models: the D3PM loop control and the decoding
of boundaries and regions into Vocal notes.

Ported from openvpi/GAME (MIT): `ValidationConfig.d3pm_sample_ts_resolved`,
`forward_segmenter_main`, `regions_to_durations` and the combining done by
`SaveCombinedFileCallback` in `inference/callbacks.py`.
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass

import numpy as np

from note_detector.notes import Note

# GAME's defaults, which `infer.py extract` uses.
D3PM_STEPS = 8
D3PM_T0 = 0.0
BOUNDARY_THRESHOLD = 0.2
# 0.02 s at the model's 10 ms frames.
BOUNDARY_RADIUS_FRAMES = 2
PRESENCE_THRESHOLD = 0.2
# Language 0 is "unset or universal"; GAME has no Portuguese and the
# benchmark found "unset" as good as "en".
LANGUAGE_UNSET = 0


def d3pm_times(steps: int = D3PM_STEPS, t0: float = D3PM_T0) -> list[float]:
    """The t of each sampling step: from t0 up to (not including) 1."""
    step = (1 - t0) / steps
    return [t0 + i * step for i in range(steps)]


def sample_boundaries(
    segment: Callable[[np.ndarray, float], np.ndarray],
    known: np.ndarray,
    times: Sequence[float],
) -> np.ndarray:
    """Runs the D3PM loop: each step refines the previous step's boundaries.

    `segment(previous, t)` is one pass of the segmenter. The first pass starts
    from the known boundaries.
    """
    boundaries = known
    for t in times:
        boundaries = segment(boundaries, t)
    return boundaries


def region_durations(
    boundaries: np.ndarray, mask: np.ndarray, timestep: float
) -> np.ndarray:
    """Seconds of each region the boundaries cut the masked frames into."""
    regions = (np.cumsum(boundaries.astype(np.int64)) + 1) * mask
    count = int(regions.max())
    return np.bincount(regions, minlength=count + 1)[1 : count + 1] * timestep


@dataclass(frozen=True)
class RegionScores:
    durations: np.ndarray
    presence: np.ndarray
    pitches: np.ndarray


def clip_notes(
    scores: RegionScores, offset: float, length: float
) -> list[Note]:
    """The voiced regions of one clip as notes.

    Times are seconds from the vocals' start. A region's end is clamped to the
    clip's length, and an empty one is dropped.
    """
    ends = np.minimum(np.cumsum(scores.durations), length) + offset
    starts = np.minimum(np.cumsum(scores.durations) - scores.durations, length)
    starts = starts + offset
    return [
        Note(float(pitch), float(start), float(end))
        for pitch, start, end, voiced in zip(
            scores.pitches, starts, ends, scores.presence, strict=True
        )
        if voiced and end - start > 0
    ]


def combine_notes(notes: Sequence[Note]) -> list[Note]:
    """Orders the notes of all clips and trims overlaps between neighbours."""
    combined: list[Note] = []
    last_end = 0.0
    for note in sorted(notes, key=lambda n: (n.start, n.end, n.pitch)):
        start = max(note.start, last_end)
        end = max(note.end, start)
        if end <= start:
            continue
        combined.append(Note(note.pitch, start, end))
        last_end = end
    return combined
