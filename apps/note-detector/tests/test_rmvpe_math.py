import numpy as np
import pytest

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


def test_frames_are_centered_every_10_ms_from_t_zero():
    assert maths.frame_count(0) == 1
    assert maths.frame_count(159) == 1
    assert maths.frame_count(160) == 2
    # 3 s at 16 kHz: one frame per 10 ms plus the one at t = 0.
    assert maths.frame_count(3 * maths.SAMPLE_RATE) == 301


@pytest.mark.parametrize(
    ("frames", "padded"), [(1, 32), (32, 32), (33, 64), (301, 320)]
)
def test_frames_are_padded_to_a_multiple_of_32(frames, padded):
    assert maths.padded_frame_count(frames) == padded


def test_chunks_cover_every_frame_once_with_context_around():
    chunks = maths.plan_chunks(250, size=100, context=10)

    assert chunks == [
        maths.Chunk(start=0, end=110, keep_start=0, keep_end=100),
        maths.Chunk(start=90, end=210, keep_start=100, keep_end=200),
        maths.Chunk(start=190, end=250, keep_start=200, keep_end=250),
    ]


def test_a_short_input_is_one_chunk():
    assert maths.plan_chunks(5, size=100, context=10) == [
        maths.Chunk(start=0, end=5, keep_start=0, keep_end=5)
    ]


def test_mel_filterbank_matches_the_known_htk_construction():
    filters = maths.mel_filterbank(
        maths.SAMPLE_RATE,
        maths.N_FFT,
        maths.N_MELS,
        (maths.MEL_FMIN, maths.MEL_FMAX),
    )

    assert filters.shape == (maths.N_MELS, maths.N_FFT // 2 + 1)
    assert filters.min() >= 0
    # Nothing below fmin or above fmax, and every filter has some weight.
    freqs = np.linspace(0, maths.SAMPLE_RATE / 2, maths.N_FFT // 2 + 1)
    assert filters[:, freqs < maths.MEL_FMIN - 16].sum() == 0
    assert (filters.sum(axis=1) > 0).all()
    # Slaney normalization: each triangle has area 1 in Hz, about
    # 2 / (width) x width / 2 per Hz of resolution.
    areas = filters.sum(axis=1) * (maths.SAMPLE_RATE / maths.N_FFT)
    assert areas == pytest.approx(np.ones(maths.N_MELS), rel=0.35)
    # Filters get wider (in bins) with frequency on the mel scale.
    widths = (filters > 0).sum(axis=1)
    assert widths[-1] > widths[0]
