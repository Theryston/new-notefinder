"""Checks the Pitch curve against the real RMVPE weights.

Marked `rmvpe`: skipped unless the weights are present (RMVPE_WEIGHTS, or
/app/weights/rmvpe.pt as in the image) and the model stack is installed, so
normal CI never runs it. Run it in the image or after `uv sync --group model`:
`RMVPE_WEIGHTS=/path/rmvpe.pt uv run pytest -m rmvpe`.
"""

import math
import os
import wave
from pathlib import Path

import numpy as np
import pytest

from note_detector.pitch_curve import FRAME_SECONDS

pytestmark = pytest.mark.rmvpe

WEIGHTS = Path(os.environ.get("RMVPE_WEIGHTS", "/app/weights/rmvpe.pt"))
RATE = 44100
MEDIAN_CENTS = 6
# A high percentile too, so octave errors on a few frames cannot hide.
P95_CENTS = 15


def write_wav(path: Path, samples: np.ndarray) -> None:
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())


def sung_tone(midi: np.ndarray) -> np.ndarray:
    """A harmonic tone following `midi` (per sample), vibrato included."""
    hz = 440 * 2 ** ((midi - 69) / 12)
    phase = 2 * math.pi * np.cumsum(hz) / RATE
    return sum(np.sin(h * phase) / h for h in range(1, 9)) * 0.2


def voice_like(midi: np.ndarray) -> np.ndarray:
    """A glottal-pulse source through two vowel-like formant resonators."""
    from scipy.signal import lfilter

    hz = 440 * 2 ** ((midi - 69) / 12)
    phase = np.cumsum(hz) / RATE
    source = 2 * (phase % 1.0) - 1.0
    voice = source
    for centre, width in ((700, 130), (1220, 70)):
        radius = math.exp(-math.pi * width / RATE)
        angle = 2 * math.pi * centre / RATE
        voice = lfilter(
            [1 - radius], [1, -2 * radius * math.cos(angle), radius**2], voice
        )
    return voice / np.abs(voice).max() * 0.5


@pytest.fixture(autouse=True)
def require_weights_and_model_stack():
    for module in ("torch", "scipy", "soundfile"):
        pytest.importorskip(module)
    if not WEIGHTS.is_file():
        pytest.skip(f"RMVPE weights not found at {WEIGHTS}")


def curve_of(tmp_path: Path, samples: np.ndarray) -> list[float]:
    from note_detector.rmvpe import pitch_curve

    vocals = tmp_path / "vocals.wav"
    write_wav(vocals, samples)
    return pitch_curve(vocals, WEIGHTS)


def errors_in_cents(
    expected: np.ndarray, curve: list[float], span: slice
) -> np.ndarray:
    got = np.array(curve[span])
    assert (got > 0).mean() > 0.9, "the sung frames must be voiced"
    return np.abs(got - expected[span]) * 100


def assert_tracks(expected: np.ndarray, curve: list[float], span: slice):
    errors = errors_in_cents(expected, curve, span)
    assert np.median(errors) < MEDIAN_CENTS
    assert np.percentile(errors, 95) < P95_CENTS


def per_frame(midi_per_sample: np.ndarray) -> np.ndarray:
    return midi_per_sample[:: int(RATE * FRAME_SECONDS)]


def test_the_curve_tracks_a_sung_tone_with_vibrato(tmp_path):
    seconds = 3
    t = np.arange(seconds * RATE) / RATE
    midi = 57 + 0.3 * np.sin(2 * math.pi * 5.5 * t)
    # Silence in the middle must come back unvoiced.
    audio = sung_tone(midi)
    audio[RATE : int(1.5 * RATE)] = 0

    curve = curve_of(tmp_path, audio)

    assert len(curve) == seconds * 100 + 1
    expected = per_frame(midi)
    assert_tracks(expected, curve, slice(20, 90))
    assert_tracks(expected, curve, slice(170, 280))
    assert sum(1 for v in curve[110:140] if v > 0) < 6


def test_the_curve_follows_a_short_vowel_like_vocal_phrase(tmp_path):
    notes = [55, 59, 62, 59]
    midi = np.concatenate(
        [np.full(int(0.6 * RATE), float(note)) for note in notes]
    )
    # A short slide between notes, as a singer would do.
    midi = np.convolve(midi, np.ones(2000) / 2000, mode="same")

    curve = curve_of(tmp_path, voice_like(midi))

    expected = per_frame(midi)
    for i in range(len(notes)):
        span = slice(i * 60 + 15, i * 60 + 50)
        assert_tracks(expected, curve, span)
