"""The Vocal note this worker reports."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Note:
    # Continuous MIDI number (A4 = 69, e.g. 61.49): the pitch the singer
    # actually sang. Clients name the nearest key from it.
    pitch: float
    # Seconds from the start of the music.
    start: float
    end: float

    def to_dict(self) -> dict[str, float]:
        return {"pitch": self.pitch, "start": self.start, "end": self.end}
