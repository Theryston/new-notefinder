"""The audio the separation reads and writes, as plain arrays."""

import numpy as np

from note_detector.separation_config import AUDIO_CHANNELS


def stereo_from_samples(
    samples: np.ndarray, file_rate: int, sample_rate: int
) -> np.ndarray:
    """`(frames, channels)` read from a WAV as `(2, frames)` float32.

    Mono is duplicated and channels past the second are dropped. The API
    always sends 44.1 kHz audio, so another rate means something upstream
    broke: it fails the job rather than being resampled.
    """
    if file_rate != sample_rate:
        raise ValueError(f"expected {sample_rate} Hz audio, got {file_rate} Hz")
    if samples.shape[1] == 1:
        samples = np.repeat(samples, AUDIO_CHANNELS, axis=1)
    return np.ascontiguousarray(samples[:, :AUDIO_CHANNELS].T, dtype=np.float32)


def clip_for_pcm(audio: np.ndarray) -> np.ndarray:
    """Limits samples to [-1, 1].

    The model can overshoot full scale, and soundfile writes integer formats
    without clipping, so an overshoot would wrap around into a loud click.
    """
    return np.clip(audio, -1.0, 1.0)
