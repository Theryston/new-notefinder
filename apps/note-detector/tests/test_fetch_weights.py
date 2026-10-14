import hashlib

import pytest

from note_detector.fetch_weights import ChecksumMismatchError, fetch_weights


def test_writes_the_file_when_the_checksum_matches(tmp_path):
    source = tmp_path / "source.bin"
    source.write_bytes(b"weights")
    destination = tmp_path / "weights" / "model.pt"

    fetch_weights(
        source.as_uri(), hashlib.sha256(b"weights").hexdigest(), destination
    )

    assert destination.read_bytes() == b"weights"
    assert list(destination.parent.iterdir()) == [destination]


def test_refuses_a_file_with_another_checksum_and_leaves_nothing(tmp_path):
    source = tmp_path / "source.bin"
    source.write_bytes(b"tampered")
    destination = tmp_path / "weights" / "model.pt"

    with pytest.raises(ChecksumMismatchError, match="expected sha256"):
        fetch_weights(
            source.as_uri(),
            hashlib.sha256(b"weights").hexdigest(),
            destination,
        )

    assert list(destination.parent.iterdir()) == []
