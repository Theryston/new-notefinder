import io
import struct
import wave

import pytest

from note_detector.smoke_validation import (
    SmokeJobEvidence,
    validate_smoke_result,
)

AUDIO_FRAMES = 88_200
CURVE_FRAMES = 201
VOCALS_URL = "https://storage.test/vocals.wav"
PITCH_CURVE_URL = "https://storage.test/pitch-curve.bin"
VERSION = "note-detector@abc1234"


def _wav(
    *, channels: int = 2, sample_width: int = 2, sample_rate: int = 44_100
) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(channels)
        audio.setsampwidth(sample_width)
        audio.setframerate(sample_rate)
        audio.writeframes(b"\x00" * (AUDIO_FRAMES * channels * sample_width))
    return output.getvalue()


def _valid_inputs() -> dict[str, object]:
    curve = struct.pack(f"<{CURVE_FRAMES}H", *([6900] * CURVE_FRAMES))
    return {
        "result": {
            "vocalsUrl": VOCALS_URL,
            "pitchCurveUrl": PITCH_CURVE_URL,
            "detectorVersion": VERSION,
            "notes": [{"pitch": 69.0, "start": 0.2, "end": 0.6}],
        },
        "uploads": {"/vocals": _wav(), "/pitch-curve": curve},
        "content_types": {
            "/vocals": "audio/wav",
            "/pitch-curve": "application/octet-stream",
        },
        "progress": ["EXTRACTING_VOCALS", "DETECTING_NOTES"],
        "vocals_url": VOCALS_URL,
        "pitch_curve_url": PITCH_CURVE_URL,
        "expected_detector_version": VERSION,
        "expected_audio_frames": AUDIO_FRAMES,
    }


def _evidence(**overrides: object) -> SmokeJobEvidence:
    values = _valid_inputs()
    values.update(overrides)
    return SmokeJobEvidence(**values)


def _validate(**overrides: object) -> dict[str, object]:
    return validate_smoke_result(_evidence(**overrides))


def test_accepts_real_job_outputs_and_summarizes_them():
    summary = _validate()

    assert summary == {
        "detectorVersion": VERSION,
        "notes": 1,
        "vocalsUploadBytes": len(_wav()),
        "pitchCurveUploadBytes": CURVE_FRAMES * 2,
        "voicedPitchFrames": CURVE_FRAMES,
        "progress": ["EXTRACTING_VOCALS", "DETECTING_NOTES"],
    }


def test_rejects_a_non_object_result():
    with pytest.raises(ValueError, match="output must be an object"):
        _validate(result=None)


def test_rejects_missing_uploads():
    with pytest.raises(ValueError, match="did not upload both"):
        _validate(uploads={"/vocals": _wav()})


@pytest.mark.parametrize("path", ["/vocals", "/pitch-curve"])
def test_rejects_empty_uploads(path: str):
    uploads = _valid_inputs()["uploads"]
    uploads[path] = b""

    with pytest.raises(ValueError, match="uploaded an empty file"):
        _validate(uploads=uploads)


def test_rejects_wrong_upload_content_types():
    with pytest.raises(ValueError, match="wrong content types"):
        _validate(content_types={"/vocals": "audio/mpeg"})


def test_rejects_an_unreadable_vocals_file():
    uploads = _valid_inputs()["uploads"]
    uploads["/vocals"] = b"not a wav"

    with pytest.raises(ValueError, match="not a valid WAV"):
        _validate(uploads=uploads)


@pytest.mark.parametrize(
    "audio",
    [
        _wav(channels=1),
        _wav(sample_width=1),
        _wav(sample_rate=48_000),
        _wav()[:-10],
    ],
)
def test_rejects_wrong_vocals_format_or_duration(audio: bytes):
    uploads = _valid_inputs()["uploads"]
    uploads["/vocals"] = audio

    with pytest.raises(ValueError, match="wrong format or duration"):
        _validate(uploads=uploads)


def test_rejects_pitch_curves_with_the_wrong_frame_count():
    uploads = _valid_inputs()["uploads"]
    uploads["/pitch-curve"] = b"\x01\x00"

    with pytest.raises(ValueError, match="wrong frame count"):
        _validate(uploads=uploads)


def test_rejects_pitch_curves_without_voiced_frames():
    uploads = _valid_inputs()["uploads"]
    uploads["/pitch-curve"] = struct.pack(
        f"<{CURVE_FRAMES}H", *([0] * CURVE_FRAMES)
    )

    with pytest.raises(ValueError, match="no voiced frames"):
        _validate(uploads=uploads)


@pytest.mark.parametrize("notes", [None, []])
def test_rejects_jobs_without_notes(notes: object):
    result = _valid_inputs()["result"]
    result["notes"] = notes

    with pytest.raises(ValueError, match="returned no Vocal notes"):
        _validate(result=result)


@pytest.mark.parametrize("note", [None, {"pitch": 60, "start": 0}])
def test_rejects_malformed_notes(note: object):
    result = _valid_inputs()["result"]
    result["notes"] = [note]

    with pytest.raises(ValueError, match="malformed Vocal note"):
        _validate(result=result)


@pytest.mark.parametrize(
    "note",
    [
        {"pitch": float("nan"), "start": 0, "end": 1},
        {"pitch": True, "start": 0, "end": 1},
        {"pitch": 0, "start": 0, "end": 1},
        {"pitch": 60, "start": -1, "end": 1},
        {"pitch": 60, "start": 1, "end": 1},
    ],
)
def test_rejects_invalid_note_values(note: object):
    result = _valid_inputs()["result"]
    result["notes"] = [note]

    with pytest.raises(ValueError, match="invalid Vocal note"):
        _validate(result=result)


def test_rejects_unordered_notes():
    result = _valid_inputs()["result"]
    result["notes"] = [
        {"pitch": 60, "start": 1, "end": 2},
        {"pitch": 61, "start": 0, "end": 1},
    ]

    with pytest.raises(ValueError, match="unordered Vocal notes"):
        _validate(result=result)


@pytest.mark.parametrize("field", ["vocalsUrl", "pitchCurveUrl"])
def test_rejects_wrong_public_urls(field: str):
    result = _valid_inputs()["result"]
    result[field] = "https://storage.test/wrong"

    with pytest.raises(ValueError, match="wrong public URLs"):
        _validate(result=result)


@pytest.mark.parametrize(
    "version", ["note-detector@wrong", "note-detector@unknown"]
)
def test_rejects_wrong_or_unknown_detector_versions(version: str):
    result = _valid_inputs()["result"]
    result["detectorVersion"] = version
    expected = (
        "note-detector@unknown" if version.endswith("unknown") else VERSION
    )

    with pytest.raises(ValueError, match="wrong detector version"):
        _validate(result=result, expected_detector_version=expected)


def test_rejects_wrong_progress_stages():
    with pytest.raises(ValueError, match="unexpected progress stages"):
        _validate(progress=["DETECTING_NOTES"])
