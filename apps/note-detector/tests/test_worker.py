from pathlib import Path

from note_detector import __main__ as worker
from note_detector.contract import Upload
from note_detector.notes import Note


def test_registered_worker_handler_reuses_all_models_across_jobs(monkeypatch):
    worker.separator.cache_clear()
    game = object()
    separator = object()
    rmvpe = object()
    calls = {"game": 0, "separator": 0, "rmvpe": 0}
    loaded_separator_models: list[object] = []
    used_games: list[object] = []
    used_rmvpe: list[object] = []
    registered_handlers = []
    uploads: list[tuple[bytes, Upload]] = []
    progress: list[tuple[str, str]] = []

    def create_game() -> object:
        calls["game"] += 1
        return game

    def load_separator() -> object:
        calls["separator"] += 1
        return separator

    def load_rmvpe() -> object:
        calls["rmvpe"] += 1
        return rmvpe

    def separate(model: object, _music: Path, vocals: Path) -> None:
        loaded_separator_models.append(model)
        vocals.write_bytes(b"vocal audio")

    def detect(_vocals: Path, model: object) -> list[Note]:
        used_games.append(model)
        return [Note(69.0, 0.1, 0.4)]

    def pitch(_vocals: Path, model: object) -> list[float]:
        used_rmvpe.append(model)
        return [69.0, 69.5]

    def download(_url: str, destination: Path) -> None:
        destination.write_bytes(b"music audio")

    def upload(path: Path, target: Upload) -> None:
        uploads.append((path.read_bytes(), target))

    monkeypatch.setattr(worker, "_load_separator", load_separator)
    adapters = worker.WorkerAdapters(
        cuda_available=lambda: True,
        create_game=create_game,
        separator=worker.separator,
        load_rmvpe=load_rmvpe,
        extract_vocals=separate,
        detect_notes=detect,
        pitch_curve=pitch,
        download=download,
        upload=upload,
        start=registered_handlers.append,
        progress_update=lambda job, stage: progress.append(
            (str(job["input"]["processingId"]), stage)
        ),
    )

    try:
        worker.main(adapters)
        assert len(registered_handlers) == 1
        handler = registered_handlers[0]
        results = [handler(_job_input(index)) for index in (1, 2)]
    finally:
        worker.separator.cache_clear()

    assert calls == {"game": 1, "separator": 1, "rmvpe": 1}
    assert loaded_separator_models == [separator, separator]
    assert used_games == [game, game]
    assert used_rmvpe == [rmvpe, rmvpe]
    assert [result["notes"] for result in results] == [
        [{"pitch": 69.0, "start": 0.1, "end": 0.4}],
        [{"pitch": 69.0, "start": 0.1, "end": 0.4}],
    ]
    assert len(uploads) == 4
    assert [stage for _job_id, stage in progress] == [
        "EXTRACTING_VOCALS",
        "DETECTING_NOTES",
        "EXTRACTING_VOCALS",
        "DETECTING_NOTES",
    ]


def _job_input(index: int) -> dict[str, object]:
    return {
        "input": {
            "processingId": f"processing-{index}",
            "musicUrl": f"https://music.test/{index}.wav",
            "vocalsUpload": {
                "presignedPutUrl": f"https://storage.test/vocals-{index}",
                "contentType": "audio/wav",
                "publicUrl": f"https://cdn.test/vocals-{index}.wav",
            },
            "pitchCurveUpload": {
                "presignedPutUrl": f"https://storage.test/pitch-{index}",
                "contentType": "application/octet-stream",
                "publicUrl": f"https://cdn.test/pitch-{index}.bin",
            },
        }
    }
