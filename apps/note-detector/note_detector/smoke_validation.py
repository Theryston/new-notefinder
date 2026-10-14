"""Pure checks for the files and payload returned by the image smoke job."""

import io
import math
import struct
import wave
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

SOURCE_SAMPLE_RATE = 44_100
PITCH_SAMPLE_RATE = 16_000
PITCH_HOP_SAMPLES = 160


@dataclass(frozen=True)
class SmokeJobEvidence:
    result: object
    uploads: Mapping[str, bytes]
    content_types: Mapping[str, str]
    progress: Sequence[str]
    vocals_url: str
    pitch_curve_url: str
    expected_detector_version: str
    expected_audio_frames: int


def validate_smoke_result(evidence: SmokeJobEvidence) -> dict[str, object]:
    """Checks a completed short vocal job and returns its smoke summary."""
    result = evidence.result
    if not isinstance(result, Mapping):
        raise ValueError("smoke worker output must be an object")
    _check_uploads(evidence.uploads)
    _check_content_types(evidence.content_types)
    _check_vocals(evidence.uploads["/vocals"], evidence.expected_audio_frames)
    curve_values = _check_pitch_curve(
        evidence.uploads["/pitch-curve"], evidence.expected_audio_frames
    )
    notes = _check_notes(result.get("notes"))
    _check_outputs(
        result,
        evidence.vocals_url,
        evidence.pitch_curve_url,
        evidence.expected_detector_version,
    )
    _check_progress(evidence.progress)
    return {
        "detectorVersion": evidence.expected_detector_version,
        "notes": len(notes),
        "vocalsUploadBytes": len(evidence.uploads["/vocals"]),
        "pitchCurveUploadBytes": len(evidence.uploads["/pitch-curve"]),
        "voicedPitchFrames": sum(value > 0 for value in curve_values),
        "progress": list(evidence.progress),
    }


def _check_uploads(uploads: Mapping[str, bytes]) -> None:
    if set(uploads) != {"/vocals", "/pitch-curve"}:
        raise ValueError("smoke job did not upload both required files")
    if not uploads["/vocals"] or not uploads["/pitch-curve"]:
        raise ValueError("smoke job uploaded an empty file")


def _check_content_types(content_types: Mapping[str, str]) -> None:
    expected = {
        "/vocals": "audio/wav",
        "/pitch-curve": "application/octet-stream",
    }
    if content_types != expected:
        raise ValueError("smoke job uploaded the wrong content types")


def _check_vocals(data: bytes, expected_frames: int) -> None:
    try:
        with wave.open(io.BytesIO(data), "rb") as vocals:
            is_valid = (
                vocals.getnchannels() == 2
                and vocals.getsampwidth() == 2
                and vocals.getframerate() == SOURCE_SAMPLE_RATE
                and vocals.getcomptype() == "NONE"
                and vocals.getnframes() == expected_frames
                and len(vocals.readframes(expected_frames))
                == expected_frames * 4
            )
    except (EOFError, OSError, wave.Error) as error:
        raise ValueError("smoke vocals upload is not a valid WAV") from error
    if not is_valid:
        raise ValueError("smoke vocals WAV has the wrong format or duration")


def _check_pitch_curve(data: bytes, audio_frames: int) -> tuple[int, ...]:
    pitch_samples = math.ceil(
        audio_frames * PITCH_SAMPLE_RATE / SOURCE_SAMPLE_RATE
    )
    expected_frames = pitch_samples // PITCH_HOP_SAMPLES + 1
    if len(data) != expected_frames * 2:
        raise ValueError("smoke Pitch curve has the wrong frame count")
    values = tuple(value[0] for value in struct.iter_unpack("<H", data))
    if not any(values):
        raise ValueError("smoke Pitch curve contains no voiced frames")
    return values


def _check_notes(raw_notes: object) -> list[Mapping[str, object]]:
    if not isinstance(raw_notes, list) or not raw_notes:
        raise ValueError("smoke job returned no Vocal notes")
    notes: list[Mapping[str, object]] = []
    previous: tuple[float, float] | None = None
    for raw_note in raw_notes:
        note = _note_mapping(raw_note)
        pitch = _finite_number(note, "pitch")
        start = _finite_number(note, "start")
        end = _finite_number(note, "end")
        if pitch <= 0 or start < 0 or end <= start:
            raise ValueError("smoke job returned an invalid Vocal note")
        if previous is not None and (start, end) < previous:
            raise ValueError("smoke job returned unordered Vocal notes")
        previous = (start, end)
        notes.append(note)
    return notes


def _note_mapping(raw_note: object) -> Mapping[str, object]:
    if not isinstance(raw_note, Mapping):
        raise ValueError("smoke job returned a malformed Vocal note")
    if not {"pitch", "start", "end"}.issubset(raw_note):
        raise ValueError("smoke job returned a malformed Vocal note")
    return raw_note


def _finite_number(note: Mapping[str, object], field: str) -> float:
    value = note[field]
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        raise ValueError("smoke job returned an invalid Vocal note")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("smoke job returned an invalid Vocal note")
    return number


def _check_outputs(
    result: Mapping[str, object],
    vocals_url: str,
    pitch_curve_url: str,
    expected_detector_version: str,
) -> None:
    if (
        result.get("vocalsUrl") != vocals_url
        or result.get("pitchCurveUrl") != pitch_curve_url
    ):
        raise ValueError("smoke job returned the wrong public URLs")
    if (
        expected_detector_version == "note-detector@unknown"
        or result.get("detectorVersion") != expected_detector_version
    ):
        raise ValueError("smoke job returned the wrong detector version")


def _check_progress(progress: Sequence[str]) -> None:
    if progress != ["EXTRACTING_VOCALS", "DETECTING_NOTES"]:
        raise ValueError(f"unexpected progress stages: {list(progress)}")
