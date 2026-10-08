"""Vocal note detection: CREPE pitch tracking, then grouping into notes.

Needs the `model` dependency group. The grouping itself is in `notes.py`.
"""

from pathlib import Path

import crepe
import librosa

from nfp_audio.notes import Note, notes_from_frames

# CREPE is trained on 16 kHz audio, so the vocals are resampled to it.
SAMPLE_RATE = 16_000
# Milliseconds between CREPE frames; the legacy worker used 10.
STEP_SIZE_MS = 10


def detect_notes(vocals: Path) -> list[Note]:
    audio, sample_rate = librosa.load(str(vocals), sr=SAMPLE_RATE, mono=True)
    time, frequency, confidence, _ = crepe.predict(
        audio,
        sample_rate,
        step_size=STEP_SIZE_MS,
        viterbi=True,
        model_capacity="full",
        verbose=0,
    )
    return notes_from_frames(time, frequency, confidence)
