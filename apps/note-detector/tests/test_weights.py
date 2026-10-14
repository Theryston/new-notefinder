import hashlib
import json

import pytest

from note_detector import weights


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def entry(name: str, url: str, data: bytes) -> dict[str, str]:
    return {"name": name, "url": url, "sha256": sha256(data)}


def test_downloads_every_file_and_checks_its_sha256(tmp_path):
    source = tmp_path / "source.bin"
    source.write_bytes(b"onnx bytes")
    manifest = [entry("encoder.onnx", source.as_uri(), b"onnx bytes")]

    weights.download_weights(manifest, tmp_path / "out")

    assert (tmp_path / "out" / "encoder.onnx").read_bytes() == b"onnx bytes"


def test_a_checksum_mismatch_fails_and_removes_the_file(tmp_path):
    source = tmp_path / "source.bin"
    source.write_bytes(b"tampered")
    manifest = [entry("encoder.onnx", source.as_uri(), b"onnx bytes")]

    with pytest.raises(ValueError, match="encoder.onnx: sha256 is"):
        weights.download_weights(manifest, tmp_path / "out")

    assert not (tmp_path / "out" / "encoder.onnx").exists()


@pytest.mark.parametrize(
    "entry_",
    [
        {"name": "a.onnx", "url": "", "sha256": "abc"},
        {"name": "a.onnx", "url": "https://example.com/a", "sha256": ""},
    ],
)
def test_an_unpinned_weight_fails_before_any_download(entry_, tmp_path):
    def download(url, target):
        raise AssertionError("must not download")

    with pytest.raises(ValueError, match="a.onnx has no pinned url and sha256"):
        weights.download_weights([entry_], tmp_path, download)


def test_the_download_is_injectable(tmp_path):
    calls = []

    def download(url, target):
        calls.append(url)
        target.write_bytes(b"x")

    weights.download_weights(
        [entry("a", "https://example.com/a", b"x")], tmp_path, download
    )

    assert calls == ["https://example.com/a"]


def test_main_reads_the_manifest_and_the_target_directory(tmp_path):
    source = tmp_path / "source.bin"
    source.write_bytes(b"cfg")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps([entry("config.json", source.as_uri(), b"cfg")])
    )

    weights.main(["weights.py", str(manifest), str(tmp_path / "out")])

    assert (tmp_path / "out" / "config.json").read_bytes() == b"cfg"
