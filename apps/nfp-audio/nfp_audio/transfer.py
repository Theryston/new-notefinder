"""Moving files in and out of the job: the music is fetched by URL, the vocals
go up through the presigned PUT the API created. The worker holds no storage
credentials; the URLs are the only access it has.
"""

from pathlib import Path

import requests

from nfp_audio.contract import VocalsUpload

# (connect, read) seconds. The read timeout applies per chunk, so a slow but
# steady transfer of a long track is not cut off.
TIMEOUT = (10, 120)
CHUNK_BYTES = 1024 * 1024


def download(url: str, destination: Path) -> None:
    with requests.get(url, stream=True, timeout=TIMEOUT) as response:
        response.raise_for_status()
        with destination.open("wb") as file:
            for chunk in response.iter_content(chunk_size=CHUNK_BYTES):
                file.write(chunk)


def upload(path: Path, target: VocalsUpload) -> None:
    with path.open("rb") as file:
        response = requests.put(
            target.presigned_put_url,
            data=file,
            headers={"Content-Type": target.content_type},
            timeout=TIMEOUT,
        )
    response.raise_for_status()
