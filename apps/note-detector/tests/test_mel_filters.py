import numpy as np
import pytest

from note_detector.mel_filters import mel_filter_bank

# Computed once with librosa.filters.mel(sr=44100, n_fft=2048, n_mels=60),
# whose output this module reproduces exactly.
BINS_PER_BAND = (
    (6,) * 15
    + (7, 7, 7, 9, 9, 9, 10, 10, 11, 13, 13, 13, 15, 16, 17, 19, 20, 20)
    + (22, 24, 26, 28, 29, 31, 33, 36, 39, 41, 44, 47, 50, 54, 57, 61, 66)
    + (71, 76, 80, 86, 93, 99, 105, 113, 122, 130)
)


def test_the_bank_has_one_row_per_band_and_one_column_per_bin():
    bank = mel_filter_bank(44100, 2048, 60)

    assert bank.shape == (60, 1025)
    assert bank.dtype == np.float32


def test_each_band_covers_the_bins_librosa_gives_it():
    bank = mel_filter_bank(44100, 2048, 60)

    assert tuple((bank > 0).sum(axis=1)) == BINS_PER_BAND


@pytest.mark.parametrize(
    ("band", "bin_", "expected"),
    [
        (0, 1, 0.00500907190144062),
        (0, 2, 0.01001814380288124),
        (59, 1000, 0.00025706051383167505),
        (59, 1023, 1.071085443982156e-05),
    ],
)
def test_filter_values_match_librosa(band, bin_, expected):
    bank = mel_filter_bank(44100, 2048, 60)

    assert bank[band, bin_] == pytest.approx(expected, rel=1e-6)


def test_it_equals_librosa_when_librosa_is_installed():
    librosa = pytest.importorskip("librosa")

    expected = librosa.filters.mel(sr=44100, n_fft=2048, n_mels=60)

    assert np.array_equal(mel_filter_bank(44100, 2048, 60), expected)
