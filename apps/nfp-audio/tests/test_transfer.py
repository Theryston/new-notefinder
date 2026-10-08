from pathlib import Path

import pytest
import requests

from nfp_audio import transfer
from nfp_audio.contract import VocalsUpload


class FakeResponse:
    def __init__(self, body: bytes = b"", status: int = 200):
        self.body = body
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False

    def raise_for_status(self) -> None:
        if self.status >= 400:
            raise requests.HTTPError(f"HTTP {self.status}")

    def iter_content(self, chunk_size: int):
        for start in range(0, len(self.body), chunk_size):
            yield self.body[start : start + chunk_size]


def test_download_streams_the_body_to_the_destination(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    calls = []

    def fake_get(url, **kwargs):
        calls.append((url, kwargs))
        return FakeResponse(b"RIFF wave data")

    monkeypatch.setattr(transfer.requests, "get", fake_get)
    destination = tmp_path / "music.wav"

    transfer.download("https://files.example/music.wav", destination)

    assert destination.read_bytes() == b"RIFF wave data"
    assert calls == [
        (
            "https://files.example/music.wav",
            {"stream": True, "timeout": transfer.TIMEOUT},
        )
    ]


def test_download_fails_when_the_server_refuses(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    monkeypatch.setattr(
        transfer.requests, "get", lambda url, **_: FakeResponse(status=404)
    )

    with pytest.raises(requests.HTTPError):
        transfer.download("https://files.example/gone.wav", tmp_path / "x.wav")


def test_upload_puts_the_file_to_the_presigned_url_with_its_content_type(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    sent = {}

    def fake_put(url, data, headers, timeout):
        sent.update(url=url, body=data.read(), headers=headers)
        return FakeResponse()

    monkeypatch.setattr(transfer.requests, "put", fake_put)
    vocals = tmp_path / "vocals.wav"
    vocals.write_bytes(b"vocals")
    target = VocalsUpload(
        presigned_put_url="https://storage.example/put?sig=1",
        content_type="audio/wav",
        public_url="https://files.example/vocals.wav",
    )

    transfer.upload(vocals, target)

    assert sent == {
        "url": "https://storage.example/put?sig=1",
        "body": b"vocals",
        "headers": {"Content-Type": "audio/wav"},
    }


def test_upload_fails_when_storage_refuses(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    monkeypatch.setattr(
        transfer.requests,
        "put",
        lambda url, **_: FakeResponse(status=403),
    )
    vocals = tmp_path / "vocals.wav"
    vocals.write_bytes(b"vocals")
    target = VocalsUpload(
        presigned_put_url="https://storage.example/put?sig=expired",
        content_type="audio/wav",
        public_url="https://files.example/vocals.wav",
    )

    with pytest.raises(requests.HTTPError):
        transfer.upload(vocals, target)
