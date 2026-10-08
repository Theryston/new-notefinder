"""RunPod serverless entrypoint: `python -m nfp_audio` in the GPU image."""

import logging

import runpod

from nfp_audio.handler import Steps, process
from nfp_audio.pitch import detect_notes
from nfp_audio.separation import extract_vocals
from nfp_audio.transfer import download, upload


def run_job(job: dict[str, object]) -> dict[str, object]:
    steps = Steps(
        download=download,
        extract_vocals=extract_vocals,
        upload=upload,
        detect_notes=detect_notes,
        report_progress=lambda stage: runpod.serverless.progress_update(
            job, stage
        ),
    )
    return process(job.get("input"), steps)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    runpod.serverless.start({"handler": run_job})


if __name__ == "__main__":
    main()
