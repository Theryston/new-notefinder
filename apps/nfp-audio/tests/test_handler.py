from pathlib import Path

import pytest

from nfp_audio.contract import VocalsUpload
from nfp_audio.handler import DETECTING_NOTES, EXTRACTING_VOCALS, Steps, process
from nfp_audio.notes import Note

MUSIC_URL = "https://files.example/music/track.wav"
TARGET = VocalsUpload(
    presigned_put_url="https://storage.example/put?sig=1",
    content_type="audio/wav",
    public_url="https://files.example/vocals/track.wav",
)


def valid_input() -> dict[str, object]:
    return {
        "processingId": "processing-1",
        "musicUrl": MUSIC_URL,
        "vocalsUpload": {
            "presignedPutUrl": TARGET.presigned_put_url,
            "contentType": TARGET.content_type,
            "publicUrl": TARGET.public_url,
        },
    }


class FakeWorker:
    """Stands in for the download, separation, upload, detection and RunPod.

    Each fake writes what it was given, so a test can follow the bytes from
    the download to the upload and to the detection.
    """

    def __init__(self, notes=None, detect_error=None):
        self.progress: list[str] = []
        self.downloads: list[str] = []
        self.uploads: list[tuple[bytes, VocalsUpload]] = []
        self.detected: list[bytes] = []
        self._notes = notes if notes is not None else [_a4()]
        self._detect_error = detect_error

    def steps(self) -> Steps:
        return Steps(
            download=self.download,
            extract_vocals=self.extract_vocals,
            upload=self.upload,
            detect_notes=self.detect_notes,
            report_progress=self.progress.append,
        )

    def download(self, url: str, destination: Path) -> None:
        self.downloads.append(url)
        destination.write_bytes(f"music from {url}".encode())

    def extract_vocals(self, music: Path, vocals: Path) -> None:
        vocals.write_bytes(b"vocals of " + music.read_bytes())

    def upload(self, path: Path, target: VocalsUpload) -> None:
        self.uploads.append((path.read_bytes(), target))

    def detect_notes(self, vocals: Path) -> list[Note]:
        self.detected.append(vocals.read_bytes())
        if self._detect_error is not None:
            raise self._detect_error
        return self._notes


def _a4() -> Note:
    return Note("A", 4, 0.0, 0.5, 440.0)


def test_reports_the_two_stages_in_order():
    worker = FakeWorker()

    process(valid_input(), worker.steps())

    assert worker.progress == [EXTRACTING_VOCALS, DETECTING_NOTES]


def test_separates_the_music_and_uploads_the_vocals_to_the_presigned_url():
    worker = FakeWorker()

    process(valid_input(), worker.steps())

    assert worker.downloads == [MUSIC_URL]
    assert worker.uploads == [
        (f"vocals of music from {MUSIC_URL}".encode(), TARGET)
    ]


def test_detects_the_notes_of_the_vocals_not_of_the_music():
    worker = FakeWorker()

    process(valid_input(), worker.steps())

    assert worker.detected == [f"vocals of music from {MUSIC_URL}".encode()]


def test_answers_with_the_public_vocals_url_and_the_notes():
    worker = FakeWorker(notes=[_a4()])

    output = process(valid_input(), worker.steps())

    assert output == {
        "vocalsUrl": TARGET.public_url,
        "notes": [
            {
                "note": "A",
                "octave": 4,
                "start": 0.0,
                "end": 0.5,
                "frequency_mean": 440.0,
            }
        ],
    }


def test_answers_with_no_notes_when_none_were_detected():
    worker = FakeWorker(notes=[])

    output = process(valid_input(), worker.steps())

    assert output["notes"] == []


def test_an_invalid_input_fails_before_any_work():
    worker = FakeWorker()
    raw = valid_input()
    del raw["musicUrl"]

    with pytest.raises(ValueError, match="musicUrl"):
        process(raw, worker.steps())

    assert worker.progress == []
    assert worker.downloads == []


def test_a_failed_detection_fails_the_job():
    worker = FakeWorker(detect_error=RuntimeError("CREPE failed"))

    with pytest.raises(RuntimeError, match="CREPE failed"):
        process(valid_input(), worker.steps())
