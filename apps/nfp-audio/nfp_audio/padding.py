"""How a spectrogram is padded before the separation model reads it.

Pure arithmetic, kept apart from `separation.py` (which needs torch) so the
tests can check it on any machine.
"""


def make_padding(
    width: int, cropsize: int, offset: int
) -> tuple[int, int, int]:
    """Pads a spectrogram of `width` frames into whole crops.

    Returns the left padding, the right padding, and `roi_size`: the frames
    each crop contributes, which is the crop size minus `offset` at each edge.
    When the two offsets consume the whole crop (cropsize == 2 * offset) the
    crop size is used instead, as the legacy worker did.
    """
    left = offset
    roi_size = cropsize - offset * 2
    if roi_size == 0:
        roi_size = cropsize
    right = roi_size - (width % roi_size) + left

    return left, right, roi_size
