"""Downloads a model weights file and verifies its sha256, at image build.

`python fetch_weights.py <url> <sha256> <destination>`. The file is written
only when the checksum matches, so a half-downloaded or tampered file can
never end up in the image.
"""

import hashlib
import sys
import tempfile
import urllib.request
from pathlib import Path

CHUNK_BYTES = 1 << 20


class ChecksumMismatchError(RuntimeError):
    pass


def fetch_weights(url: str, sha256: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    with (
        tempfile.NamedTemporaryFile(
            dir=destination.parent, delete=False
        ) as temporary,
        urllib.request.urlopen(url) as response,
    ):
        while chunk := response.read(CHUNK_BYTES):
            digest.update(chunk)
            temporary.write(chunk)
    downloaded = Path(temporary.name)
    if digest.hexdigest() != sha256:
        downloaded.unlink()
        raise ChecksumMismatchError(
            f"{url}: expected sha256 {sha256}, got {digest.hexdigest()}"
        )
    downloaded.chmod(0o644)
    downloaded.replace(destination)


if __name__ == "__main__":  # pragma: no cover
    fetch_weights(sys.argv[1], sys.argv[2], Path(sys.argv[3]))
