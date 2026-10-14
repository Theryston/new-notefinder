import pytest

from note_detector.contract import ProcessingInput, Upload, parse_input


def valid_upload(name: str) -> dict[str, object]:
    return {
        "presignedPutUrl": f"https://storage.example/put/{name}?sig=1",
        "contentType": "audio/wav" if name == "vocals" else "x/y",
        "publicUrl": f"https://files.example/{name}",
    }


def valid_input() -> dict[str, object]:
    return {
        "processingId": "processing-1",
        "musicUrl": "https://files.example/music.wav",
        "vocalsUpload": valid_upload("vocals"),
        "pitchCurveUpload": valid_upload("pitch-curve"),
    }


def test_parses_the_job_input():
    parsed = parse_input(valid_input())

    assert parsed == ProcessingInput(
        processing_id="processing-1",
        music_url="https://files.example/music.wav",
        vocals_upload=Upload(
            presigned_put_url="https://storage.example/put/vocals?sig=1",
            content_type="audio/wav",
            public_url="https://files.example/vocals",
        ),
        pitch_curve_upload=Upload(
            presigned_put_url="https://storage.example/put/pitch-curve?sig=1",
            content_type="x/y",
            public_url="https://files.example/pitch-curve",
        ),
    )


@pytest.mark.parametrize(
    ("key", "message"),
    [
        ("processingId", "processingId must be a non-empty string"),
        ("musicUrl", "musicUrl must be a non-empty string"),
    ],
)
def test_rejects_a_missing_top_level_field(key, message):
    raw = valid_input()
    del raw[key]

    with pytest.raises(ValueError, match=message):
        parse_input(raw)


@pytest.mark.parametrize("upload", ["vocalsUpload", "pitchCurveUpload"])
@pytest.mark.parametrize(
    "field", ["presignedPutUrl", "contentType", "publicUrl"]
)
def test_rejects_an_empty_upload_field(upload, field):
    raw = valid_input()
    raw[upload] = {**valid_upload("vocals"), field: ""}

    with pytest.raises(ValueError, match=f"{upload}.{field}"):
        parse_input(raw)


@pytest.mark.parametrize("upload", ["vocalsUpload", "pitchCurveUpload"])
def test_rejects_a_missing_upload(upload):
    raw = valid_input()
    del raw[upload]

    with pytest.raises(ValueError, match=f"{upload} must be an object"):
        parse_input(raw)


def test_rejects_a_non_string_field():
    raw = valid_input()
    raw["musicUrl"] = 42

    with pytest.raises(ValueError, match="musicUrl"):
        parse_input(raw)


def test_rejects_an_input_that_is_not_an_object():
    with pytest.raises(ValueError, match="input must be an object"):
        parse_input(["not", "an", "object"])
