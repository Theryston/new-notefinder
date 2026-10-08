"""STFT helpers the separation model needs at inference time.

Ported from the legacy worker's `extract_vocals_lib/spec_utils.py`. The
training, caching and debug helpers of the original are left out: nothing in
the worker calls them, and removing them cannot change a separation.
"""

import librosa
import numpy as np


def crop_center(h1, h2):
    h1_shape = h1.size()
    h2_shape = h2.size()

    if h1_shape[3] == h2_shape[3]:
        return h1
    elif h1_shape[3] < h2_shape[3]:
        raise ValueError("h1_shape[3] must be greater than h2_shape[3]")

    s_time = (h1_shape[3] - h2_shape[3]) // 2
    e_time = s_time + h2_shape[3]
    h1 = h1[:, :, :, s_time:e_time]

    return h1


def wave_to_spectrogram(wave, hop_length, n_fft):
    spec_left = librosa.stft(wave[0], n_fft=n_fft, hop_length=hop_length)
    spec_right = librosa.stft(wave[1], n_fft=n_fft, hop_length=hop_length)
    spec = np.asarray([spec_left, spec_right])

    return spec


def spectrogram_to_wave(spec, hop_length=1024):
    if spec.ndim == 2:
        wave = librosa.istft(spec, hop_length=hop_length)
    elif spec.ndim == 3:
        wave_left = librosa.istft(spec[0], hop_length=hop_length)
        wave_right = librosa.istft(spec[1], hop_length=hop_length)
        wave = np.asarray([wave_left, wave_right])

    return wave
