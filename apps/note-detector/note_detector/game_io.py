"""What the onnxruntime adapter feeds to GAME's modules, built without them.

Everything that can be checked without a model lives here, so `game.py` is
only the calls into onnxruntime.
"""

from collections.abc import Mapping
from pathlib import Path

import numpy as np

from note_detector.game_decode import (
    BOUNDARY_THRESHOLD,
    LANGUAGE_UNSET,
    PRESENCE_THRESHOLD,
)
from note_detector.game_pipeline import Encoded

# Where the image build puts the ONNX release (see `weights.py`).
DEFAULT_DIR = Path(__file__).resolve().parent.parent / "weights" / "game-medium"
DIR_VARIABLE = "NOTE_DETECTOR_GAME_DIR"


def game_directory(environ: Mapping[str, str]) -> Path:
    return Path(environ.get(DIR_VARIABLE, DEFAULT_DIR))


def mono_vocals(
    samples: np.ndarray, file_rate: int, sample_rate: int
) -> np.ndarray:
    """Mono samples of a [frames, channels] read; the rate must be the model's.

    The separation step writes 44.1 kHz, which is what GAME medium expects, so
    another rate means something upstream broke.
    """
    if file_rate != sample_rate:
        raise ValueError(
            f"the vocals are {file_rate} Hz, GAME expects {sample_rate} Hz"
        )
    return samples.mean(axis=1)


def only_inputs(
    feeds: Mapping[str, np.ndarray], accepted: set[str]
) -> dict[str, np.ndarray]:
    """The feeds a graph takes: it has no input for what the model lacks
    (no `language` when the model has no languages)."""
    return {name: value for name, value in feeds.items() if name in accepted}


def segmenter_feeds(
    encoded: Encoded,
    known: np.ndarray,
    previous: np.ndarray,
    step: tuple[float, int],
) -> dict[str, np.ndarray]:
    """All inputs of one segmenter pass; `step` is (t, radius in frames)."""
    t, radius = step
    return {
        "x_seg": encoded.x_seg,
        "language": np.array([LANGUAGE_UNSET], dtype=np.int64),
        "known_boundaries": known,
        "prev_boundaries": previous,
        "t": np.array([t], dtype=np.float32),
        "maskT": encoded.mask,
        "threshold": np.array(BOUNDARY_THRESHOLD, dtype=np.float32),
        "radius": np.array(radius, dtype=np.int64),
    }


def region_count(boundaries: np.ndarray) -> int:
    """The regions the boundaries cut the frames into."""
    return int(boundaries.sum()) + 1


def estimator_feeds(
    encoded: Encoded, boundaries: np.ndarray
) -> dict[str, np.ndarray]:
    return {
        "x_est": encoded.x_est,
        "boundaries": boundaries,
        "maskT": encoded.mask,
        "maskN": np.ones((1, region_count(boundaries)), dtype=bool),
        "threshold": np.array(PRESENCE_THRESHOLD, dtype=np.float32),
    }
