"""The Pitch curve file: the singer's pitch moment by moment.

Little-endian Uint16, one value per 10 ms frame from t = 0. A value is
`round(MIDI x 100)` (cents above MIDI 0) and 0 means no voice at that frame.
Uploaded as `application/octet-stream`. The API only stores it; the format
is the contract with whatever reads it later.
"""

import math
from collections.abc import Iterable

import numpy as np

# Seconds between two values of the file.
FRAME_SECONDS = 0.01
UNVOICED = 0
MAX_VALUE = 0xFFFF
# Cents per MIDI number.
SCALE = 100


def encode_pitch_curve(frames: Iterable[float]) -> bytes:
    """Encodes one MIDI number per frame; 0, negative or NaN is unvoiced."""
    values = [_encode_frame(frame) for frame in frames]
    return np.array(values, dtype="<u2").tobytes()


def _encode_frame(midi: float) -> int:
    if math.isnan(midi) or midi <= 0:
        return UNVOICED
    # Round half up, not to even, so the result does not depend on parity. A
    # voiced frame never encodes as 0, which would read as unvoiced.
    cents = midi * SCALE + 0.5
    if cents >= MAX_VALUE:
        return MAX_VALUE
    return max(math.floor(cents), 1)
