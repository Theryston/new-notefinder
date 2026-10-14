import numpy as np
import pytest

from note_detector import pitch_curve
from note_detector import rmvpe_math as maths


def salience_peaking_at(bin_index: int, height: float = 1.0) -> np.ndarray:
    row = np.zeros(maths.N_BINS)
    row[bin_index] = height
    return row


def bin_midi(bin_index: int) -> float:
    cents = maths.CENTS_BASE + maths.CENTS_PER_BIN * bin_index
    return 69 + 12 * np.log2(10 * 2 ** (cents / 1200) / 440)


def test_a_single_peak_decodes_to_the_midi_of_its_bin():
    midi = maths.salience_to_midi(np.array([salience_peaking_at(100)]))

    assert midi == [pytest.approx(bin_midi(100))]
    # Bin 100 is about 100.5 Hz, a little below G2 (43.5).
    assert midi[0] == pytest.approx(43.46, abs=0.01)


def test_neighbouring_bins_pull_the_pitch_by_their_weight():
    row = salience_peaking_at(100)
    row[101] = 1.0

    midi = maths.salience_to_midi(np.array([row]))

    assert midi == [pytest.approx((bin_midi(100) + bin_midi(101)) / 2)]


def test_only_four_bins_each_side_of_the_peak_count():
    row = salience_peaking_at(100)
    row[105] = 0.5

    assert maths.salience_to_midi(np.array([row])) == [
        pytest.approx(bin_midi(100))
    ]


def test_a_bin_four_away_is_in_the_average_and_five_away_is_not():
    for offset, inside in [(4, True), (-4, True), (5, False), (-5, False)]:
        row = salience_peaking_at(100)
        row[100 + offset] = 0.5

        midi = maths.salience_to_midi(np.array([row]))[0]

        assert (midi != pytest.approx(bin_midi(100))) is inside


def test_the_window_is_clipped_at_the_edges_of_the_bins():
    low = maths.salience_to_midi(np.array([salience_peaking_at(0)]))
    high = maths.salience_to_midi(
        np.array([salience_peaking_at(maths.N_BINS - 1)])
    )

    assert low == [pytest.approx(bin_midi(0))]
    assert high == [pytest.approx(bin_midi(maths.N_BINS - 1))]


def test_a_peak_at_or_below_the_voicing_threshold_is_unvoiced():
    rows = np.array(
        [
            salience_peaking_at(100, maths.VOICING_THRESHOLD),
            salience_peaking_at(100, maths.VOICING_THRESHOLD + 0.001),
            np.zeros(maths.N_BINS),
        ]
    )

    midi = maths.salience_to_midi(rows)

    assert midi[0] == 0.0
    assert midi[1] > 0
    assert midi[2] == 0.0


def test_one_value_per_frame_in_order():
    rows = np.array([salience_peaking_at(40), salience_peaking_at(200)])

    midi = maths.salience_to_midi(rows)

    assert midi == [pytest.approx(bin_midi(40)), pytest.approx(bin_midi(200))]


def test_the_threshold_can_be_given():
    row = salience_peaking_at(100, 0.2)

    assert maths.salience_to_midi(np.array([row]), threshold=0.5) == [0.0]


def test_one_frame_is_the_pitch_curve_file_frame():
    assert maths.HOP_LENGTH / maths.SAMPLE_RATE == pytest.approx(
        pitch_curve.FRAME_SECONDS
    )


def test_frames_are_centered_every_10_ms_from_t_zero():
    assert maths.frame_count(0) == 1
    assert maths.frame_count(159) == 1
    assert maths.frame_count(160) == 2
    # 3 s at 16 kHz: one frame per 10 ms plus the one at t = 0.
    assert maths.frame_count(3 * maths.SAMPLE_RATE) == 301


def test_a_curve_with_the_wrong_number_of_frames_is_refused():
    maths.check_frame_count(301, 3 * maths.SAMPLE_RATE)

    for frames in (300, 302):
        with pytest.raises(ValueError, match="expected 301"):
            maths.check_frame_count(frames, 3 * maths.SAMPLE_RATE)


@pytest.mark.parametrize(
    ("frames", "padding"), [(1, 31), (31, 1), (32, 0), (33, 31), (301, 19)]
)
def test_frames_are_padded_to_a_multiple_of_32(frames, padding):
    assert maths.frame_padding(frames) == padding


@pytest.mark.parametrize(
    ("rate", "ratio"),
    [
        (44100, (160, 441)),
        (48000, (1, 3)),
        (16000, (1, 1)),
        (22050, (320, 441)),
    ],
)
def test_resample_ratio_to_16_khz(rate, ratio):
    assert maths.resample_ratio(rate) == ratio


def test_mel_filterbank_matches_librosa():
    # Values of librosa.filters.mel(sr=16000, n_fft=1024, n_mels=128,
    # fmin=30, fmax=8000, htk=True), computed once.
    filters = maths.mel_filterbank()

    assert filters.shape == (maths.N_MELS, maths.N_FFT // 2 + 1)
    assert filters.sum() == pytest.approx(8.189247131347656, rel=1e-6)
    for row, total, peak_bin, peak in [
        (0, 0.0629606768488884, 3, 0.056785039603710175),
        (1, 0.06330661475658417, 4, 0.050391726195812225),
        (64, 0.0644158124923706, 118, 0.02016606368124485),
        (127, 0.06386382132768631, 501, 0.005860890727490187),
    ]:
        assert filters[row].sum() == pytest.approx(total, rel=1e-6)
        assert int(np.argmax(filters[row])) == peak_bin
        assert filters[row].max() == pytest.approx(peak, rel=1e-6)


def test_mel_filterbank_has_nothing_outside_its_band():
    filters = maths.mel_filterbank()

    # Bins 0 and 1 are 0 and 15.6 Hz, below fmin (30 Hz); the last bin is
    # fmax itself (8 kHz, Nyquist).
    assert filters[:, :2].sum() == 0
    assert filters[:, -1].max() < 1e-12
