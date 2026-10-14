import struct
from dataclasses import replace
from pathlib import Path

import pytest

from note_detector.contract import Upload
from note_detector.handler import (
    DETECTING_NOTES,
    EXTRACTING_VOCALS,
    Steps,
    process,
)
from note_detector.notes import Note

MUSIC_URL = "https://files.example/music/track.wav"
VOCALS_TARGET = Upload(
    presigned_put_url="https://storage.example/put/vocals?sig=1",
    content_type="audio/wav",
    public_url="https://files.example/vocals/track.wav",
)
CURVE_TARGET = Upload(
    presigned_put_url="https://storage.example/put/curve?sig=2",
    content_type="application/octet-stream",
    public_url="https://files.example/pitch-curve/track.bin",
)
VERSION = "note-detector@abc1234"


def valid_input() -> dict[str, object]:
    return {
        "processingId": "processing-1",
        "musicUrl": MUSIC_URL,
        "vocalsUpload": _wire(VOCALS_TARGET),
        "pitchCurveUpload": _wire(CURVE_TARGET),
    }


def _wire(target: Upload) -> dict[str, str]:
    return {
        "presignedPutUrl": target.presigned_put_url,
        "contentType": target.content_type,
        "publicUrl": target.public_url,
    }


class FakeWorker:
    """Stands in for the download, separation, upload, detection and RunPod.

    Each fake writes what it was given, so a test can follow the bytes from
    the download to the upload and to the detection. `fail_at` names the step
    that raises.
    """

    def __init__(self, notes=None, frames=None, fail_at=None):
        self.events: list[str] = []
        self.progress: list[str] = []
        self.downloads: list[str] = []
        self.uploads: list[tuple[bytes, Upload]] = []
        self.detected: list[bytes] = []
        self.pitch_curve_inputs: list[bytes] = []
        self._notes = notes if notes is not None else [_a4()]
        self._frames = frames if frames is not None else [0.0, 69.0]
        self._fail_at = fail_at

    def steps(self) -> Steps:
        return Steps(
            download=self.download,
            extract_vocals=self.extract_vocals,
            upload=self.upload,
            detect_notes=self.detect_notes,
            pitch_curve=self.pitch_curve,
            report_progress=self.report_progress,
            detector_version=VERSION,
        )

    def _step(self, name: str) -> None:
        self.events.append(name)
        if self._fail_at == name:
            raise RuntimeError(f"{name} failed")

    def report_progress(self, stage: str) -> None:
        self.progress.append(stage)
        self.events.append(stage)

    def download(self, url: str, destination: Path) -> None:
        self._step("download")
        self.downloads.append(url)
        destination.write_bytes(f"music from {url}".encode())

    def extract_vocals(self, music: Path, vocals: Path) -> None:
        self._step("extract_vocals")
        vocals.write_bytes(b"vocals of " + music.read_bytes())

    def upload(self, path: Path, target: Upload) -> None:
        name = "upload_vocals" if target == VOCALS_TARGET else "upload_curve"
        self._step(name)
        self.uploads.append((path.read_bytes(), target))

    def detect_notes(self, vocals: Path) -> list[Note]:
        self._step("detect_notes")
        self.detected.append(vocals.read_bytes())
        return self._notes

    def pitch_curve(self, vocals: Path) -> list[float]:
        self._step("pitch_curve")
        self.pitch_curve_inputs.append(vocals.read_bytes())
        return self._frames


def _raising(_stage: str) -> None:
    raise RuntimeError("progress failed")


def _a4() -> Note:
    return Note(69.0, 0.0, 0.5)


VOCALS = f"vocals of music from {MUSIC_URL}".encode()


def test_reports_the_two_stages_in_order():
    worker = FakeWorker()

    process(valid_input(), worker.steps())

    assert worker.progress == [EXTRACTING_VOCALS, DETECTING_NOTES]


def test_runs_the_steps_in_order_around_the_progress_updates():
    worker = FakeWorker()

    process(valid_input(), worker.steps())

    assert worker.events == [
        EXTRACTING_VOCALS,
        "download",
        "extract_vocals",
        "upload_vocals",
        DETECTING_NOTES,
        "detect_notes",
        "pitch_curve",
        "upload_curve",
    ]


def test_separates_the_music_and_uploads_the_vocals_to_the_presigned_url():
    worker = FakeWorker()

    process(valid_input(), worker.steps())

    assert worker.downloads == [MUSIC_URL]
    assert worker.uploads[0] == (VOCALS, VOCALS_TARGET)


def test_detects_notes_and_the_pitch_curve_of_the_vocals_not_the_music():
    worker = FakeWorker()

    process(valid_input(), worker.steps())

    assert worker.detected == [VOCALS]
    assert worker.pitch_curve_inputs == [VOCALS]


def test_uploads_the_encoded_pitch_curve_to_its_own_presigned_url():
    worker = FakeWorker(frames=[0.0, 69.0, 61.494])

    process(valid_input(), worker.steps())

    body, target = worker.uploads[1]
    assert target == CURVE_TARGET
    assert struct.unpack("<3H", body) == (0, 6900, 6149)


def test_answers_with_the_urls_the_version_and_the_notes():
    worker = FakeWorker(notes=[Note(61.49, 1.0, 2.0)])

    output = process(valid_input(), worker.steps())

    assert output == {
        "vocalsUrl": VOCALS_TARGET.public_url,
        "pitchCurveUrl": CURVE_TARGET.public_url,
        "detectorVersion": VERSION,
        "notes": [{"pitch": 61.49, "start": 1.0, "end": 2.0}],
    }


def test_orders_the_notes_by_time():
    worker = FakeWorker(
        notes=[
            Note(60.0, 2.0, 3.0),
            Note(62.0, 0.5, 1.0),
            Note(61.0, 0.5, 0.75),
        ]
    )

    output = process(valid_input(), worker.steps())

    assert output["notes"] == [
        {"pitch": 61.0, "start": 0.5, "end": 0.75},
        {"pitch": 62.0, "start": 0.5, "end": 1.0},
        {"pitch": 60.0, "start": 2.0, "end": 3.0},
    ]


def test_answers_with_no_notes_when_none_were_detected():
    worker = FakeWorker(notes=[])

    output = process(valid_input(), worker.steps())

    assert output["notes"] == []


def test_an_empty_pitch_curve_fails_the_job_before_uploading_it():
    worker = FakeWorker(frames=[])

    with pytest.raises(ValueError, match="no frames"):
        process(valid_input(), worker.steps())

    assert worker.events[-1] == "pitch_curve"


def test_a_failing_progress_report_fails_the_job():
    worker = FakeWorker()
    steps = replace(worker.steps(), report_progress=_raising)

    with pytest.raises(RuntimeError, match="progress"):
        process(valid_input(), steps)

    assert worker.downloads == []


@pytest.mark.parametrize("missing", ["musicUrl", "pitchCurveUpload"])
def test_an_invalid_input_fails_before_any_work(missing):
    worker = FakeWorker()
    raw = valid_input()
    del raw[missing]

    with pytest.raises(ValueError, match=missing):
        process(raw, worker.steps())

    assert worker.events == []


@pytest.mark.parametrize(
    "step",
    [
        "download",
        "extract_vocals",
        "upload_vocals",
        "detect_notes",
        "pitch_curve",
        "upload_curve",
    ],
)
def test_every_failed_step_fails_the_job(step):
    worker = FakeWorker(fail_at=step)

    with pytest.raises(RuntimeError, match=f"{step} failed"):
        process(valid_input(), worker.steps())


def test_a_failed_pitch_curve_upload_is_the_last_thing_the_job_does():
    worker = FakeWorker(fail_at="upload_curve")

    with pytest.raises(RuntimeError):
        process(valid_input(), worker.steps())

    assert worker.events[-1] == "upload_curve"
    assert worker.progress == [EXTRACTING_VOCALS, DETECTING_NOTES]
