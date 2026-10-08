"""The RunPod job input this worker accepts, as the API sends it.

The API is the only caller. It never talks to this worker directly: it starts
a job with `/run` and reads the answer from `/status`, so the input here and
the output in `handler.py` are the whole interface. See CLAUDE.md.
"""

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class VocalsUpload:
    """Where the vocals WAV goes: a presigned PUT, and the URL it will have."""

    presigned_put_url: str
    content_type: str
    public_url: str


@dataclass(frozen=True)
class ProcessingInput:
    processing_id: str
    music_url: str
    vocals_upload: VocalsUpload


def parse_input(raw: object) -> ProcessingInput:
    """Validates a RunPod job input, raising ValueError on the first problem."""
    data = _object(raw, "input")
    upload = _object(data.get("vocalsUpload"), "vocalsUpload")
    return ProcessingInput(
        processing_id=_text(data, "processingId", "processingId"),
        music_url=_text(data, "musicUrl", "musicUrl"),
        vocals_upload=VocalsUpload(
            presigned_put_url=_text(
                upload, "presignedPutUrl", "vocalsUpload.presignedPutUrl"
            ),
            content_type=_text(
                upload, "contentType", "vocalsUpload.contentType"
            ),
            public_url=_text(upload, "publicUrl", "vocalsUpload.publicUrl"),
        ),
    )


def _object(value: object, name: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{name} must be an object")
    return value


def _text(data: Mapping[str, object], key: str, name: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"{name} must be a non-empty string")
    return value
