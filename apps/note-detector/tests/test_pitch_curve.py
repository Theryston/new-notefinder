import struct

import pytest

from note_detector.pitch_curve import encode_pitch_curve


def decode(data: bytes) -> list[int]:
    return list(struct.unpack(f"<{len(data) // 2}H", data))


def test_encodes_cents_above_midi_zero_as_little_endian_uint16():
    data = encode_pitch_curve([69.0, 60.5])

    assert data == b"\xf4\x1a" + b"\xa2\x17"
    assert decode(data) == [6900, 6050]


def test_rounds_to_the_nearest_cent():
    assert decode(encode_pitch_curve([61.494, 61.496])) == [6149, 6150]


def test_rounds_half_a_cent_up_whatever_the_parity():
    # 0.125 and 0.375 are exact in binary, so x100 lands on .5 exactly.
    assert decode(encode_pitch_curve([60.125, 60.375])) == [6013, 6038]


@pytest.mark.parametrize("frame", [0.0, -3.0, float("nan")])
def test_unvoiced_frames_are_zero(frame):
    assert decode(encode_pitch_curve([frame])) == [0]


def test_a_voiced_frame_never_collapses_to_zero():
    assert decode(encode_pitch_curve([0.001])) == [1]


def test_clamps_to_the_uint16_range():
    assert decode(encode_pitch_curve([655.35, 700.0, float("inf")])) == [
        65535,
        65535,
        65535,
    ]


def test_an_empty_curve_is_an_empty_file():
    assert encode_pitch_curve([]) == b""


def test_keeps_one_value_per_frame_in_order():
    frames = [0.0, 60.0, 0.0, 62.0]

    assert decode(encode_pitch_curve(iter(frames))) == [0, 6000, 0, 6200]
