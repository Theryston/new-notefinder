import pytest

from nfp_audio.contract import ProcessingInput, VocalsUpload, parse_input


def valid_upload() -> dict[str, object]:
    return {
        "presignedPutUrl": "https://storage.example/put?sig=1",
        "contentType": "audio/wav",
        "publicUrl": "https://files.example/vocals.wav",
    }


def valid_input() -> dict[str, object]:
    return {
        "processingId": "processing-1",
        "musicUrl": "https://files.example/music.wav",
        "vocalsUpload": valid_upload(),
    }


def test_parses_the_job_input():
    parsed = parse_input(valid_input())

    assert parsed == ProcessingInput(
        processing_id="processing-1",
        music_url="https://files.example/music.wav",
        vocals_upload=VocalsUpload(
            presigned_put_url="https://storage.example/put?sig=1",
            content_type="audio/wav",
            public_url="https://files.example/vocals.wav",
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


@pytest.mark.parametrize(
    "field",
    ["presignedPutUrl", "contentType", "publicUrl"],
)
def test_rejects_an_empty_vocals_upload_field(field):
    raw = valid_input()
    raw["vocalsUpload"] = {**valid_upload(), field: ""}

    with pytest.raises(ValueError, match=f"vocalsUpload.{field}"):
        parse_input(raw)


def test_rejects_a_missing_vocals_upload():
    raw = valid_input()
    del raw["vocalsUpload"]

    with pytest.raises(ValueError, match="vocalsUpload must be an object"):
        parse_input(raw)


def test_rejects_an_input_that_is_not_an_object():
    with pytest.raises(ValueError, match="input must be an object"):
        parse_input(["not", "an", "object"])
