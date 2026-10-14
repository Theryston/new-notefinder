"""The pure maths around RMVPE: no torch, no weights.

RMVPE turns a mel spectrogram into a salience over 360 pitch bins (20 cents
apart, from about 32.7 Hz). These helpers build the mel filterbank the RVC
checkpoint was trained with, do the sizing arithmetic around the network
(resampling ratio, padding, expected frame count) and decode the salience
into one MIDI number per 10 ms frame.
"""

import math

import numpy as np

SAMPLE_RATE = 16000
# 10 ms at 16 kHz: `pitch_curve.FRAME_SECONDS`, the Pitch curve file's frame.
HOP_LENGTH = 160
N_FFT = 1024
N_MELS = 128
MEL_FMIN = 30.0
MEL_FMAX = 8000.0
# The log of the mel spectrogram never sees less than this.
LOG_FLOOR = 1e-5
# RMVPE's own voicing: a frame whose peak salience is at or below this is
# unvoiced. Kept raw, as the spec decides.
VOICING_THRESHOLD = 0.03
# The network pools the time axis 5 times by 2, so it needs multiples of 32.
FRAME_MULTIPLE = 32

# Bin i is at CENTS_BASE + 20 * i cents above 10 Hz.
CENTS_BASE = 1997.3794084376191
CENTS_PER_BIN = 20.0
N_BINS = 360
# The local average covers the peak bin and 4 bins on each side.
AVERAGE_RADIUS = 4
MIDI_A4 = 69.0
HZ_A4 = 440.0
REFERENCE_HZ = 10.0


def _hz_to_htk_mel(hz: np.ndarray | float) -> np.ndarray | float:
    return 2595.0 * np.log10(1.0 + np.asarray(hz) / 700.0)


def _htk_mel_to_hz(mel: np.ndarray) -> np.ndarray:
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


def mel_filterbank() -> np.ndarray:
    """HTK mel triangles with Slaney area normalization, (N_MELS, bins).

    Same filters as `librosa.filters.mel(sr=16000, n_fft=1024, n_mels=128,
    fmin=30, fmax=8000, htk=True)`, which the checkpoint was trained with;
    written out here so the worker needs no librosa.
    """
    fft_freqs = np.linspace(0.0, SAMPLE_RATE / 2, 1 + N_FFT // 2)
    edges = _htk_mel_to_hz(
        np.linspace(
            float(_hz_to_htk_mel(MEL_FMIN)),
            float(_hz_to_htk_mel(MEL_FMAX)),
            N_MELS + 2,
        )
    )
    widths = np.diff(edges)
    ramps = edges[:, None] - fft_freqs[None, :]
    lower = -ramps[:-2] / widths[:-1, None]
    upper = ramps[2:] / widths[1:, None]
    filters = np.maximum(0.0, np.minimum(lower, upper))
    return filters * (2.0 / (edges[2:] - edges[:-2]))[:, None]


def resample_ratio(rate: int) -> tuple[int, int]:
    """(up, down) to bring audio at `rate` Hz to SAMPLE_RATE."""
    divisor = math.gcd(rate, SAMPLE_RATE)
    return SAMPLE_RATE // divisor, rate // divisor


def frame_count(n_samples: int) -> int:
    """Frames of a centered STFT: frame i is centered at i x 10 ms."""
    return n_samples // HOP_LENGTH + 1


def check_frame_count(n_frames: int, n_samples: int) -> None:
    """Fails unless the curve has one value per 10 ms from t = 0, which is
    what the Pitch curve file promises."""
    expected = frame_count(n_samples)
    if n_frames != expected:
        raise ValueError(
            f"the Pitch curve has {n_frames} frames, expected {expected}"
        )


def frame_padding(n_frames: int) -> int:
    """Frames to append so the network gets a multiple of FRAME_MULTIPLE."""
    return -n_frames % FRAME_MULTIPLE


def salience_to_midi(
    salience: np.ndarray, threshold: float = VOICING_THRESHOLD
) -> list[float]:
    """Decodes (frames, 360) salience into one MIDI number per frame.

    The pitch of a frame is the salience-weighted mean of the 9 bins around
    its peak; a frame whose peak is at or below `threshold` is unvoiced and
    becomes 0.
    """
    frames = salience.shape[0]
    centers = np.argmax(salience, axis=1) + AVERAGE_RADIUS
    padded = np.pad(salience, ((0, 0), (AVERAGE_RADIUS, AVERAGE_RADIUS)))
    cents = np.pad(
        CENTS_BASE + CENTS_PER_BIN * np.arange(N_BINS),
        (AVERAGE_RADIUS, AVERAGE_RADIUS),
    )
    offsets = np.arange(-AVERAGE_RADIUS, AVERAGE_RADIUS + 1)
    window = centers[:, None] + offsets[None, :]
    weights = np.take_along_axis(padded, window, axis=1)
    weight_sum = weights.sum(axis=1)
    # A peak above the threshold is in its own window, so the sum is positive.
    voiced = padded.max(axis=1) > threshold
    averaged = np.divide(
        (weights * cents[window]).sum(axis=1),
        weight_sum,
        out=np.zeros(frames),
        where=voiced,
    )
    return [_cents_to_midi(value) if value > 0 else 0.0 for value in averaged]


def _cents_to_midi(cents: float) -> float:
    hz = REFERENCE_HZ * 2.0 ** (cents / 1200.0)
    return MIDI_A4 + 12.0 * math.log2(hz / HZ_A4)
