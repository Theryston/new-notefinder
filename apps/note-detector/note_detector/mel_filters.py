"""The Slaney mel filter bank, written out so the worker needs no librosa.

Same filters as `librosa.filters.mel(sr=..., n_fft=..., n_mels=...)` with its
defaults (Slaney mel scale, Slaney area normalization, fmin 0, fmax sr / 2),
which the Mel-Band RoFormer uses to decide which STFT bins belong to which
band. Pinned against librosa's values in the tests.
"""

import numpy as np

# Slaney's scale: linear below 1 kHz, logarithmic above.
_F_SP = 200.0 / 3
_MIN_LOG_HZ = 1000.0
_MIN_LOG_MEL = _MIN_LOG_HZ / _F_SP
_LOG_STEP = np.log(6.4) / 27.0


def _hz_to_mel(hz: np.ndarray) -> np.ndarray:
    mels = hz / _F_SP
    above = hz >= _MIN_LOG_HZ
    mels[above] = _MIN_LOG_MEL + np.log(hz[above] / _MIN_LOG_HZ) / _LOG_STEP
    return mels


def _mel_to_hz(mels: np.ndarray) -> np.ndarray:
    hz = _F_SP * mels
    above = mels >= _MIN_LOG_MEL
    hz[above] = _MIN_LOG_HZ * np.exp(_LOG_STEP * (mels[above] - _MIN_LOG_MEL))
    return hz


def mel_filter_bank(sample_rate: int, n_fft: int, n_mels: int) -> np.ndarray:
    """Triangular filters, `(n_mels, n_fft // 2 + 1)` float32."""
    bin_hz = np.linspace(0, sample_rate / 2, 1 + n_fft // 2)
    edge_mels = np.linspace(
        _hz_to_mel(np.array([0.0]))[0],
        _hz_to_mel(np.array([sample_rate / 2]))[0],
        n_mels + 2,
    )
    edges = _mel_to_hz(edge_mels)

    steps = np.diff(edges)
    ramps = np.subtract.outer(edges, bin_hz)
    lower = -ramps[:-2] / steps[:-1, None]
    upper = ramps[2:] / steps[1:, None]

    bank = np.zeros((n_mels, bin_hz.size), dtype=np.float32)
    bank[:] = np.maximum(0, np.minimum(lower, upper))
    # Slaney normalization: each filter has constant area.
    bank *= (2.0 / (edges[2 : n_mels + 2] - edges[:n_mels]))[:, None]
    return bank
