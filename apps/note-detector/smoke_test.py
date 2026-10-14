"""Runs one short vocal job through the built image's real worker steps."""

import io
import json
import logging
import os
import threading
from dataclasses import replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from note_detector.__main__ import (
    _production_adapters,
    load_worker_models,
    steps_for_job,
)
from note_detector.handler import process
from note_detector.smoke_validation import (
    SOURCE_SAMPLE_RATE,
    SmokeJobEvidence,
    validate_smoke_result,
)
from note_detector.version import detector_version

# Held notes, a one-second silence, vibrato and harmonics, matching the
# synthesized singing fixture used by the GAME parity test.
MELODY: list[tuple[int | None, float]] = [
    (57, 0.7),
    (60, 0.7),
    (64, 0.9),
    (62, 0.6),
    (None, 1.0),
    (60, 0.8),
    (65, 0.7),
    (64, 1.0),
]


def _voice(midi: int, seconds: float):
    import numpy as np

    time = np.arange(round(seconds * SOURCE_SAMPLE_RATE)) / SOURCE_SAMPLE_RATE
    semitones = midi + 0.3 * np.sin(2 * np.pi * 5.5 * time)
    frequency = 440.0 * 2 ** ((semitones - 69) / 12)
    phase = 2 * np.pi * np.cumsum(frequency) / SOURCE_SAMPLE_RATE
    waveform = sum(
        np.sin(harmonic * phase) / harmonic for harmonic in range(1, 7)
    )
    envelope = np.minimum(1.0, np.minimum(time, seconds - time) / 0.05)
    return (0.3 * waveform * envelope).astype(np.float32)


def _sample_wav() -> tuple[bytes, int]:
    import numpy as np
    import soundfile

    parts = [
        np.zeros(round(seconds * SOURCE_SAMPLE_RATE), dtype=np.float32)
        if midi is None
        else _voice(midi, seconds)
        for midi, seconds in MELODY
    ]
    mono = np.concatenate(parts)
    stereo = np.repeat(mono[:, None], 2, axis=1)
    output = io.BytesIO()
    soundfile.write(
        output, stereo, SOURCE_SAMPLE_RATE, format="WAV", subtype="PCM_16"
    )
    return output.getvalue(), len(mono)


def _server(
    sample: bytes,
) -> tuple[ThreadingHTTPServer, dict[str, bytes], dict[str, str]]:
    uploads: dict[str, bytes] = {}
    content_types: dict[str, str] = {}

    class SmokeHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path != "/music.wav":
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(sample)))
            self.end_headers()
            self.wfile.write(sample)

        def do_PUT(self) -> None:
            length = int(self.headers.get("Content-Length", "0"))
            uploads[self.path] = self.rfile.read(length)
            content_types[self.path] = self.headers.get("Content-Type", "")
            self.send_response(200)
            self.end_headers()

        def log_message(self, _format: str, *_args: object) -> None:
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), SmokeHandler)
    return server, uploads, content_types


def _job(base_url: str) -> dict[str, object]:
    return {
        "input": {
            "processingId": "image-smoke",
            "musicUrl": f"{base_url}/music.wav",
            "vocalsUpload": {
                "presignedPutUrl": f"{base_url}/vocals",
                "contentType": "audio/wav",
                "publicUrl": f"{base_url}/public/vocals.wav",
            },
            "pitchCurveUpload": {
                "presignedPutUrl": f"{base_url}/pitch-curve",
                "contentType": "application/octet-stream",
                "publicUrl": f"{base_url}/public/pitch-curve.bin",
            },
        }
    }


def run() -> dict[str, object]:
    logging.basicConfig(level=logging.INFO)
    adapters = _production_adapters()
    models = load_worker_models(adapters)
    sample, audio_frames = _sample_wav()
    server, uploads, content_types = _server(sample)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    base_url = f"http://{host}:{port}"
    progress: list[str] = []
    smoke_adapters = replace(
        adapters, progress_update=lambda _job, stage: progress.append(stage)
    )
    job = _job(base_url)

    try:
        steps = steps_for_job(smoke_adapters, models, job)
        result = process(job["input"], steps)
    finally:
        server.shutdown()
        server.server_close()
        thread.join()

    evidence = SmokeJobEvidence(
        result=result,
        uploads=uploads,
        content_types=content_types,
        progress=progress,
        vocals_url=f"{base_url}/public/vocals.wav",
        pitch_curve_url=f"{base_url}/public/pitch-curve.bin",
        expected_detector_version=detector_version(os.environ),
        expected_audio_frames=audio_frames,
    )
    return validate_smoke_result(evidence)


def main() -> None:
    print(json.dumps(run(), sort_keys=True))


if __name__ == "__main__":
    main()
