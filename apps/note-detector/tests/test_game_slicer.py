import numpy as np
import pytest

from note_detector.game_slicer import slice_vocals

SAMPLE_RATE = 44100
HOP = 882  # 20 ms


def tone(seconds: float, rate: int = SAMPLE_RATE) -> np.ndarray:
    t = np.arange(round(seconds * rate)) / rate
    return (0.5 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


def silence(seconds: float, rate: int = SAMPLE_RATE) -> np.ndarray:
    return np.zeros(round(seconds * rate), dtype=np.float32)


def noisy_gap(seconds: float) -> np.ndarray:
    """Tone, a silence of low noise (below -40 dB), tone: a deterministic
    wave whose cut is not at a symmetric position."""
    rng = np.random.default_rng(0)
    noise = rng.standard_normal(round(seconds * SAMPLE_RATE)) * 0.002
    return np.concatenate([tone(2), noise.astype(np.float32), tone(2)])


def cut(wave: np.ndarray) -> list[tuple[float, int]]:
    return [
        (c.offset, len(c.waveform)) for c in slice_vocals(wave, SAMPLE_RATE)
    ]


def test_a_short_waveform_is_a_single_clip():
    wave = tone(0.9)

    (clip,) = slice_vocals(wave, SAMPLE_RATE)

    assert clip.offset == 0
    assert clip.waveform is wave


def test_a_waveform_with_no_silence_is_a_single_clip():
    wave = tone(3)

    (clip,) = slice_vocals(wave, SAMPLE_RATE)

    assert clip.offset == 0
    assert clip.waveform is wave


def test_a_waveform_of_only_silence_has_no_clip():
    assert slice_vocals(silence(3), SAMPLE_RATE) == []


def test_noise_below_the_threshold_leaves_at_most_the_kept_silence():
    rng = np.random.default_rng(0)
    wave = (rng.standard_normal(3 * SAMPLE_RATE) * 0.001).astype(np.float32)

    clips = slice_vocals(wave, SAMPLE_RATE)

    assert sum(len(c.waveform) for c in clips) <= 0.1 * SAMPLE_RATE


def test_a_silence_between_sounds_cuts_two_clips():
    wave = np.concatenate([tone(2), silence(1), tone(2)])

    first, second = slice_vocals(wave, SAMPLE_RATE)

    assert first.offset == 0
    assert 2.0 <= len(first.waveform) / SAMPLE_RATE <= 2.2
    assert 2.8 <= second.offset <= 3.1
    assert len(second.waveform) / SAMPLE_RATE == pytest.approx(
        5 - second.offset, abs=0.05
    )


def test_a_clip_is_offset_by_where_it_starts():
    wave = np.concatenate([tone(2), silence(1), tone(2)])

    _, second = slice_vocals(wave, SAMPLE_RATE)

    start_sample = round(second.offset * SAMPLE_RATE)
    assert start_sample % HOP == 0
    np.testing.assert_array_equal(
        second.waveform,
        wave[start_sample : start_sample + len(second.waveform)],
    )


def test_the_rate_scales_the_cut_in_seconds():
    rate = 22050
    wave = np.concatenate([tone(2, rate), silence(1, rate), tone(2, rate)])

    first, second = slice_vocals(wave, rate)

    assert 2.0 <= len(first.waveform) / rate <= 2.2
    assert 2.8 <= second.offset <= 3.1


def test_adjacent_silences_cut_adjacent_clips():
    wave = np.concatenate(
        [tone(1.5), silence(0.5), tone(1.5), silence(0.5), tone(1.5)]
    )

    clips = slice_vocals(wave, SAMPLE_RATE)

    assert len(clips) == 3
    offsets = [clip.offset for clip in clips]
    assert offsets == sorted(offsets)
    assert 1.8 <= clips[1].offset <= 2.1
    assert 3.8 <= clips[2].offset <= 4.1


def test_a_silence_shorter_than_the_minimum_interval_does_not_cut():
    wave = np.concatenate([tone(2), silence(0.1), tone(2)])

    assert len(slice_vocals(wave, SAMPLE_RATE)) == 1


def test_a_clip_shorter_than_the_minimum_length_is_not_cut_off():
    wave = np.concatenate([tone(0.5), silence(0.5), tone(2)])

    assert len(slice_vocals(wave, SAMPLE_RATE)) == 1


def test_a_leading_silence_is_dropped():
    wave = np.concatenate([silence(1), tone(2)])

    (clip,) = slice_vocals(wave, SAMPLE_RATE)

    assert 0.8 <= clip.offset <= 1.0
    assert len(clip.waveform) / SAMPLE_RATE == pytest.approx(
        3 - clip.offset, abs=0.05
    )


def test_a_short_leading_silence_is_dropped():
    wave = np.concatenate([silence(0.15), tone(2)])

    (clip,) = slice_vocals(wave, SAMPLE_RATE)

    assert clip.offset == pytest.approx(0.02)


def test_a_medium_leading_silence_is_dropped():
    wave = np.concatenate([silence(0.4), tone(2)])

    (clip,) = slice_vocals(wave, SAMPLE_RATE)

    assert 0.2 <= clip.offset <= 0.4


@pytest.mark.parametrize(
    ("gap", "expected"),
    [
        # Silences not much longer than the minimum interval: the cut spans
        # the quietest frames of both ends, whichever order they come in.
        (0.26, [(0.0, 92610), (2.22, 89964)]),
        (0.27, [(0.0, 92610), (2.22, 90405)]),
    ],
)
def test_a_short_silence_is_cut_at_the_quietest_frames_of_both_ends(
    gap, expected
):
    assert cut(noisy_gap(gap)) == expected


@pytest.mark.parametrize(
    ("gap", "expected"),
    [
        (0.5, [(0.0, 92610), (2.38, 93492)]),
        (0.7, [(0.0, 92610), (2.6, 92610)]),
    ],
)
def test_a_long_silence_is_cut_at_the_quietest_frames_of_the_kept_edges(
    gap, expected
):
    assert cut(noisy_gap(gap)) == expected
