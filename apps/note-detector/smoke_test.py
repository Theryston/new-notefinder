"""Runs one short job through the image's real models and transfer helpers."""

import io
import json
import logging
import math
import os
import struct
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch

from note_detector.__main__ import separator, steps_for_job
from note_detector.game import GameOnnx
from note_detector.game_io import game_directory
from note_detector.handler import process
from note_detector.rmvpe import load_rmvpe, pitch_curve_with_model
from note_detector.startup import require_gpu, reuse_model
from note_detector.version import detector_version

SAMPLE_RATE = 44_100
DURATION_SECONDS = 2


def _sample_wav() -> bytes:
    samples = io.BytesIO()
    with wave.open(samples, "wb") as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for index in range(SAMPLE_RATE * DURATION_SECONDS):
            time = index / SAMPLE_RATE
            fundamental = 220 + 4 * math.sin(2 * math.pi * 5 * time)
            value = sum(
                math.sin(2 * math.pi * fundamental * harmonic * time) / harmonic
                for harmonic in range(1, 7)
            )
            sample = max(-1.0, min(1.0, value * 0.45))
            encoded = struct.pack("<h", round(sample * 32767))
            frames.extend(encoded * 2)
        audio.writeframes(frames)
    return samples.getvalue()


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


def run() -> dict[str, object]:
    try:
        require_gpu(torch.cuda.is_available())
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    logging.basicConfig(level=logging.INFO)
    sample = _sample_wav()
    server, uploads, content_types = _server(sample)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    base_url = f"http://{host}:{port}"
    vocals_url = f"{base_url}/public/vocals.wav"
    pitch_curve_url = f"{base_url}/public/pitch-curve.bin"
    progress: list[str] = []

    try:
        game = GameOnnx(game_directory(os.environ))
        separator()
        pitch_curve_step = reuse_model(load_rmvpe(), pitch_curve_with_model)
        steps = steps_for_job(
            game,
            pitch_curve_step,
            progress.append,
        )
        result = process(
            {
                "processingId": "image-smoke",
                "musicUrl": f"{base_url}/music.wav",
                "vocalsUpload": {
                    "presignedPutUrl": f"{base_url}/vocals",
                    "contentType": "audio/wav",
                    "publicUrl": vocals_url,
                },
                "pitchCurveUpload": {
                    "presignedPutUrl": f"{base_url}/pitch-curve",
                    "contentType": "application/octet-stream",
                    "publicUrl": pitch_curve_url,
                },
            },
            steps,
        )
    finally:
        server.shutdown()
        server.server_close()
        thread.join()

    if set(uploads) != {"/vocals", "/pitch-curve"}:
        raise RuntimeError("smoke job did not upload both required files")
    if not uploads["/vocals"] or not uploads["/pitch-curve"]:
        raise RuntimeError("smoke job uploaded an empty file")
    if content_types != {
        "/vocals": "audio/wav",
        "/pitch-curve": "application/octet-stream",
    }:
        raise RuntimeError("smoke job uploaded the wrong content types")
    notes = result.get("notes")
    if not isinstance(notes, list) or any(
        not isinstance(note, dict)
        or not {"pitch", "start", "end"}.issubset(note)
        for note in notes
    ):
        raise RuntimeError("smoke job did not return a notes list")
    expected_version = detector_version(os.environ)
    if (
        result.get("detectorVersion") != expected_version
        or expected_version == "note-detector@unknown"
    ):
        raise RuntimeError("smoke job returned the wrong detector version")
    if (
        result.get("vocalsUrl") != vocals_url
        or result.get("pitchCurveUrl") != pitch_curve_url
    ):
        raise RuntimeError("smoke job returned the wrong public URLs")
    if progress != ["EXTRACTING_VOCALS", "DETECTING_NOTES"]:
        raise RuntimeError(f"unexpected progress stages: {progress}")

    summary: dict[str, object] = {
        "detectorVersion": result["detectorVersion"],
        "notes": len(notes),
        "vocalsUploadBytes": len(uploads["/vocals"]),
        "pitchCurveUploadBytes": len(uploads["/pitch-curve"]),
        "progress": progress,
    }
    return summary


def main() -> None:
    print(json.dumps(run(), sort_keys=True))


if __name__ == "__main__":
    main()
