"""Downloads the model weights named by a manifest and verifies their sha256.

Run by the image build (`python note_detector/weights.py <manifest> <dir>`),
so it only uses the standard library: it runs before the dependencies are
copied next to it, and a cold start never needs the network. A weight with no
pinned url or checksum fails the build instead of shipping unverified bytes.
"""

import hashlib
import json
import sys
import urllib.request
from collections.abc import Callable
from pathlib import Path

CHUNK_BYTES = 1 << 20


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while chunk := file.read(CHUNK_BYTES):
            digest.update(chunk)
    return digest.hexdigest()


def fetch(url: str, target: Path) -> None:
    with urllib.request.urlopen(url) as response, target.open("wb") as file:  # noqa: S310
        while chunk := response.read(CHUNK_BYTES):
            file.write(chunk)


def download_weights(
    manifest: list[dict[str, str]],
    directory: Path,
    download: Callable[[str, Path], None] = fetch,
) -> None:
    """Downloads every entry of the manifest into `directory`.

    An entry is `{"name", "url", "sha256"}`. A file whose checksum differs is
    deleted and fails the run.
    """
    directory.mkdir(parents=True, exist_ok=True)
    for entry in manifest:
        name, url, expected = entry["name"], entry["url"], entry["sha256"]
        if not url or not expected:
            raise ValueError(f"{name} has no pinned url and sha256")
        target = directory / name
        download(url, target)
        actual = sha256_of(target)
        if actual != expected:
            target.unlink()
            raise ValueError(
                f"{name}: sha256 is {actual}, the manifest pins {expected}"
            )


def main(argv: list[str]) -> None:
    manifest_path, directory = Path(argv[1]), Path(argv[2])
    download_weights(json.loads(manifest_path.read_text()), directory)


if __name__ == "__main__":  # pragma: no cover
    main(sys.argv)
