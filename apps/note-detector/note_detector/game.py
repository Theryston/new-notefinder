"""The onnxruntime adapter of GAME medium: the Vocal notes step.

Glue only the GPU image exercises (omitted from coverage); the loop it feeds
is `game_pipeline.py`. The sessions are created once per worker process.
Checked against GAME's own `infer.py extract` by the parity test.
"""

import json
import os
from functools import cache
from pathlib import Path

import numpy as np
import onnxruntime as ort
import soundfile as sf

from note_detector.game_decode import (
    BOUNDARY_RADIUS_FRAMES,
    BOUNDARY_THRESHOLD,
    LANGUAGE_UNSET,
    PRESENCE_THRESHOLD,
)
from note_detector.game_pipeline import Encoded, detect_notes
from note_detector.notes import Note

# Where the image build puts the ONNX release (see `weights.py`).
DEFAULT_DIR = Path(__file__).resolve().parent.parent / "weights" / "game-medium"
PROVIDERS = ["CUDAExecutionProvider", "CPUExecutionProvider"]


class GameOnnx:
    def __init__(self, directory: Path, providers: list[str] = PROVIDERS):
        config = json.loads((directory / "config.json").read_text())
        self.sample_rate: int = config["samplerate"]
        self.timestep: float = config["timestep"]
        self._encoder = _session(directory / "encoder.onnx", providers)
        self._segmenter = _session(directory / "segmenter.onnx", providers)
        self._estimator = _session(directory / "estimator.onnx", providers)
        self._segmenter_inputs = {i.name for i in self._segmenter.get_inputs()}

    def encode(self, waveform: np.ndarray, duration: float) -> Encoded:
        x_seg, x_est, mask = self._encoder.run(
            ["x_seg", "x_est", "maskT"],
            {
                "waveform": waveform.astype(np.float32)[None, :],
                "duration": np.array([duration], dtype=np.float32),
            },
        )
        return Encoded(x_seg, x_est, mask)

    def segment(
        self,
        encoded: Encoded,
        known: np.ndarray,
        previous: np.ndarray,
        t: float,
    ) -> np.ndarray:
        feeds = {
            "x_seg": encoded.x_seg,
            "language": np.array([LANGUAGE_UNSET], dtype=np.int64),
            "known_boundaries": known,
            "prev_boundaries": previous,
            "t": np.array([t], dtype=np.float32),
            "maskT": encoded.mask,
            "threshold": np.array(BOUNDARY_THRESHOLD, dtype=np.float32),
            "radius": np.array(BOUNDARY_RADIUS_FRAMES, dtype=np.int64),
        }
        # The graph only takes the inputs the model uses (no language input
        # when it has no languages).
        feeds = {k: v for k, v in feeds.items() if k in self._segmenter_inputs}
        (boundaries,) = self._segmenter.run(["boundaries"], feeds)
        return boundaries

    def estimate(
        self, encoded: Encoded, boundaries: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray]:
        regions = int(boundaries.sum()) + 1
        presence, scores = self._estimator.run(
            ["presence", "scores"],
            {
                "x_est": encoded.x_est,
                "boundaries": boundaries,
                "maskT": encoded.mask,
                "maskN": np.ones((1, regions), dtype=bool),
                "threshold": np.array(PRESENCE_THRESHOLD, dtype=np.float32),
            },
        )
        return presence[0], scores[0]


def _session(path: Path, providers: list[str]) -> ort.InferenceSession:
    return ort.InferenceSession(str(path), providers=providers)


def read_vocals(path: Path, sample_rate: int) -> np.ndarray:
    """Mono float32 samples; the separation step writes 44.1 kHz."""
    samples, file_rate = sf.read(path, dtype="float32", always_2d=True)
    if file_rate != sample_rate:
        raise ValueError(
            f"the vocals are {file_rate} Hz, GAME expects {sample_rate} Hz"
        )
    return samples.mean(axis=1)


@cache
def load_game() -> GameOnnx:
    directory = Path(os.environ.get("NOTE_DETECTOR_GAME_DIR", DEFAULT_DIR))
    return GameOnnx(directory)


def find_notes(vocals: Path) -> list[Note]:
    """The Vocal notes step of the handler."""
    game = load_game()
    return detect_notes(read_vocals(vocals, game.sample_rate), game)
