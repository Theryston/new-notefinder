"""The pure maths around RMVPE: no torch, no weights.

RMVPE turns a mel spectrogram into a salience over 360 pitch bins (20 cents
apart, from about 32.7 Hz). These helpers build the mel filterbank the RVC
checkpoint was trained with, plan the chunks the spectrogram is run in, and
decode the salience into one MIDI number per 10 ms frame.
"""

import math
from dataclasses import dataclass

import numpy as np

SAMPLE_RATE = 16000
HOP_LENGTH = 160
N_FFT = 1024
N_MELS = 128
MEL_FMIN = 30.0
MEL_FMAX = 8000.0
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


def mel_filterbank(
    sample_rate: int, n_fft: int, n_mels: int, band: tuple[float, float]
) -> np.ndarray:
    """HTK mel triangles with Slaney area normalization, (n_mels, bins).

    Same filters as `librosa.filters.mel(htk=True)`, which the checkpoint was
    trained with; written out here so the worker needs no librosa.
    """
    fmin, fmax = band
    fft_freqs = np.linspace(0.0, sample_rate / 2, 1 + n_fft // 2)
    edges = _htk_mel_to_hz(
        np.linspace(
            float(_hz_to_htk_mel(fmin)), float(_hz_to_htk_mel(fmax)), n_mels + 2
        )
    )
    widths = np.diff(edges)
    ramps = edges[:, None] - fft_freqs[None, :]
    lower = -ramps[:-2] / widths[:-1, None]
    upper = ramps[2:] / widths[1:, None]
    filters = np.maximum(0.0, np.minimum(lower, upper))
    return filters * (2.0 / (edges[2:] - edges[:-2]))[:, None]


def frame_count(n_samples: int) -> int:
    """Frames of a centered STFT: frame i is centered at i x 10 ms."""
    return n_samples // HOP_LENGTH + 1


def padded_frame_count(n_frames: int) -> int:
    return FRAME_MULTIPLE * ((n_frames - 1) // FRAME_MULTIPLE + 1)


@dataclass(frozen=True)
class Chunk:
    """Run frames [start, end); keep [keep_start, keep_end) of the result."""

    start: int
    end: int
    keep_start: int
    keep_end: int


def plan_chunks(n_frames: int, size: int, context: int) -> list[Chunk]:
    """Splits the frames in chunks of `size`, each with `context` frames of
    surroundings the network sees but whose output is discarded, so a chunk
    border never decides a pitch (the GRU reads the whole window)."""
    chunks = []
    for keep_start in range(0, n_frames, size):
        keep_end = min(keep_start + size, n_frames)
        chunks.append(
            Chunk(
                start=max(0, keep_start - context),
                end=min(n_frames, keep_end + context),
                keep_start=keep_start,
                keep_end=keep_end,
            )
        )
    return chunks


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
    voiced = padded.max(axis=1) > threshold
    averaged = np.divide(
        (weights * cents[window]).sum(axis=1),
        weight_sum,
        out=np.zeros(frames),
        where=voiced & (weight_sum > 0),
    )
    return [_cents_to_midi(value) if value > 0 else 0.0 for value in averaged]


def _cents_to_midi(cents: float) -> float:
    hz = REFERENCE_HZ * 2.0 ** (cents / 1200.0)
    return MIDI_A4 + 12.0 * math.log2(hz / HZ_A4)
