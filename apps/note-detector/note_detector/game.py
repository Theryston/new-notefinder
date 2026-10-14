"""The onnxruntime adapter of GAME medium: the Vocal notes step.

Only the calls into onnxruntime and soundfile live here (omitted from
coverage); what it feeds them is built in `game_io.py` and the loop it plugs
into is `game_pipeline.py`. The sessions are created once per worker process.
Checked against GAME's own `infer.py extract` by the parity test.
"""

import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import soundfile as sf

from note_detector.game_decode import boundary_radius_frames
from note_detector.game_io import (
    estimator_feeds,
    mono_vocals,
    only_inputs,
    segmenter_feeds,
)
from note_detector.game_pipeline import Encoded, notes_in_waveform
from note_detector.notes import Note

PROVIDERS = ["CUDAExecutionProvider", "CPUExecutionProvider"]


def _session(path: Path) -> ort.InferenceSession:
    return ort.InferenceSession(str(path), providers=PROVIDERS)


class GameOnnx:
    def __init__(self, directory: Path):
        config = json.loads((directory / "config.json").read_text())
        self.sample_rate: int = config["samplerate"]
        self.timestep: float = config["timestep"]
        self._radius = boundary_radius_frames(self.timestep)
        self._encoder = _session(directory / "encoder.onnx")
        self._segmenter = _session(directory / "segmenter.onnx")
        self._estimator = _session(directory / "estimator.onnx")
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
        feeds = segmenter_feeds(encoded, known, previous, (t, self._radius))
        (boundaries,) = self._segmenter.run(
            ["boundaries"], only_inputs(feeds, self._segmenter_inputs)
        )
        return boundaries

    def estimate(
        self, encoded: Encoded, boundaries: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray]:
        presence, scores = self._estimator.run(
            ["presence", "scores"], estimator_feeds(encoded, boundaries)
        )
        return presence[0], scores[0]


def notes_in_file(vocals: Path, game: GameOnnx) -> list[Note]:
    """The Vocal notes step of the handler, for the vocals WAV at `vocals`."""
    samples, file_rate = sf.read(vocals, dtype="float32", always_2d=True)
    return notes_in_waveform(
        mono_vocals(samples, file_rate, game.sample_rate), game
    )
