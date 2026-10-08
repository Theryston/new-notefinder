import pytest

from nfp_audio.padding import make_padding


def test_pads_a_spectrogram_to_whole_crops():
    # 256-frame crops with 64-frame offsets contribute 128 frames each.
    assert make_padding(300, 256, 64) == (64, 148, 128)


def test_uses_the_crop_size_when_the_offsets_consume_the_crop():
    # cropsize == 2 * offset would leave no frames, so the crop size is used.
    assert make_padding(100, 128, 64) == (64, 92, 128)


@pytest.mark.parametrize("width", range(1, 600, 37))
def test_the_padded_width_is_a_whole_number_of_crops(width):
    left, right, roi_size = make_padding(width, 256, 64)

    assert roi_size == 128
    assert left == 64
    assert right > 0
    assert (left + width + right) % roi_size == 0
