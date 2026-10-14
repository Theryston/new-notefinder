"""Which build of the worker produced a Processing's notes.

The image is built with its git sha and the weights are pinned by checksum in
the repo, so the sha identifies code and models alike.
"""

from collections.abc import Mapping

SHA_VARIABLE = "NOTE_DETECTOR_GIT_SHA"
UNKNOWN = "unknown"


def detector_version(environ: Mapping[str, str]) -> str:
    sha = environ.get(SHA_VARIABLE, "").strip()
    return f"note-detector@{sha or UNKNOWN}"
