import numpy as np
import pytest

from note_detector.game_slicer import SAMPLE_RATE, _params, slice_vocals


def tone(seconds: float, amplitude: float = 0.5) -> np.ndarray:
    t = np.arange(round(seconds * SAMPLE_RATE)) / SAMPLE_RATE
    return (amplitude * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


def silence(seconds: float) -> np.ndarray:
    return np.zeros(round(seconds * SAMPLE_RATE), dtype=np.float32)


def test_the_parameters_are_those_of_gamess_extract():
    params = _params(SAMPLE_RATE)

    assert params.hop == 882
    assert params.window == 3528
    assert params.min_length == 50
    assert params.min_interval == 10
    assert params.max_sil_kept == 5
    assert params.threshold == pytest.approx(0.01)


def test_a_short_waveform_is_a_single_clip():
    wave = tone(0.9)

    (clip,) = slice_vocals(wave)

    assert clip.offset == 0
    assert clip.waveform is wave


def test_a_waveform_with_no_silence_is_a_single_clip():
    wave = tone(3)

    (clip,) = slice_vocals(wave)

    assert clip.offset == 0
    assert clip.waveform is wave


def test_a_waveform_of_only_silence_has_no_clip():
    assert slice_vocals(silence(3)) == []


def test_a_silence_between_sounds_cuts_two_clips():
    wave = np.concatenate([tone(2), silence(1), tone(2)])

    first, second = slice_vocals(wave)

    assert first.offset == 0
    assert 2.0 <= first.waveform.shape[0] / SAMPLE_RATE <= 2.2
    assert 2.8 <= second.offset <= 3.1
    assert second.waveform.shape[0] / SAMPLE_RATE == pytest.approx(
        5 - second.offset, abs=0.05
    )


def test_a_clip_is_offset_by_where_it_starts():
    wave = np.concatenate([tone(2), silence(1), tone(2)])

    _, second = slice_vocals(wave)

    start_sample = round(second.offset * SAMPLE_RATE)
    assert start_sample % 882 == 0
    np.testing.assert_array_equal(
        second.waveform,
        wave[start_sample : start_sample + len(second.waveform)],
    )


def test_adjacent_silences_cut_adjacent_clips():
    wave = np.concatenate(
        [tone(1.5), silence(0.5), tone(1.5), silence(0.5), tone(1.5)]
    )

    clips = slice_vocals(wave)

    assert len(clips) == 3
    offsets = [clip.offset for clip in clips]
    assert offsets == sorted(offsets)
    assert 1.8 <= clips[1].offset <= 2.1
    assert 3.8 <= clips[2].offset <= 4.1


def test_a_silence_shorter_than_the_minimum_interval_does_not_cut():
    wave = np.concatenate([tone(2), silence(0.1), tone(2)])

    assert len(slice_vocals(wave)) == 1


def test_a_clip_shorter_than_the_minimum_length_is_not_cut_off():
    wave = np.concatenate([tone(0.5), silence(0.5), tone(2)])

    clips = slice_vocals(wave)

    assert len(clips) == 1


def test_a_leading_silence_is_dropped():
    wave = np.concatenate([silence(1), tone(2)])

    (clip,) = slice_vocals(wave)

    assert 0.8 <= clip.offset <= 1.0
    assert clip.waveform.shape[0] / SAMPLE_RATE == pytest.approx(
        3 - clip.offset, abs=0.05
    )


def test_a_trailing_silence_is_dropped():
    wave = np.concatenate([tone(2), silence(1)])

    (clip,) = slice_vocals(wave)

    assert clip.offset == 0
    assert 2.0 <= clip.waveform.shape[0] / SAMPLE_RATE <= 2.2


def test_a_silence_just_over_the_minimum_interval_is_cut():
    # Not much longer than the minimum interval (0.2 s) plus the smear of the
    # RMS window: the cut spans no more than twice the kept silence.
    wave = np.concatenate([tone(2), silence(0.26), tone(2)])

    first, second = slice_vocals(wave)

    assert first.offset == 0
    assert 2.0 <= second.offset <= 2.4
    assert second.offset >= first.waveform.shape[0] / SAMPLE_RATE


def test_a_short_leading_silence_is_dropped():
    wave = np.concatenate([silence(0.15), tone(2)])

    (clip,) = slice_vocals(wave)

    assert clip.offset == pytest.approx(0.02)


def test_a_long_silence_between_sounds_leaves_the_quietest_frames_out():
    wave = np.concatenate([tone(2), silence(0.5), tone(2)])

    first, second = slice_vocals(wave)

    gap = second.offset - first.waveform.shape[0] / SAMPLE_RATE
    assert 0 <= gap <= 0.5


def test_a_medium_leading_silence_is_dropped():
    wave = np.concatenate([silence(0.4), tone(2)])

    (clip,) = slice_vocals(wave)

    assert 0.2 <= clip.offset <= 0.4
