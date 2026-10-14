import numpy as np
import pytest

from note_detector.separation_audio import clip_for_pcm, stereo_from_samples


def test_stereo_is_returned_channels_first():
    samples = np.array([[1, 2], [3, 4], [5, 6]], dtype=np.float32)

    audio = stereo_from_samples(samples, 44100, 44100)

    assert audio.tolist() == [[1, 3, 5], [2, 4, 6]]
    assert audio.dtype == np.float32
    assert audio.flags["C_CONTIGUOUS"]


def test_mono_is_duplicated_into_both_channels():
    samples = np.array([[1], [2], [3]], dtype=np.float32)

    audio = stereo_from_samples(samples, 44100, 44100)

    assert audio.tolist() == [[1, 2, 3], [1, 2, 3]]


def test_channels_past_the_second_are_dropped():
    samples = np.array([[1, 2, 3, 4], [5, 6, 7, 8]], dtype=np.float32)

    audio = stereo_from_samples(samples, 44100, 44100)

    assert audio.tolist() == [[1, 5], [2, 6]]


def test_another_sample_rate_fails_instead_of_being_resampled():
    samples = np.zeros((10, 2), np.float32)

    with pytest.raises(ValueError, match="44100 Hz audio, got 48000 Hz"):
        stereo_from_samples(samples, 48000, 44100)


def test_overshoots_are_clipped_to_full_scale():
    audio = np.array([[1.5, -2.0, 0.5, 1.0, -1.0]], np.float32)

    assert clip_for_pcm(audio).tolist() == [[1.0, -1.0, 0.5, 1.0, -1.0]]
