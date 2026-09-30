"""Paths, JSONL helpers and latency statistics shared by the harness."""

import json
import math
import os
import re
from pathlib import Path

WORK = Path(os.environ.get("BENCH_WORK", "/work"))
QUERIES = WORK / "queries"
EXPORT = WORK / "export"
RESULTS = WORK / "results"

# Fields of a Recording document, in the order they are searched (most
# important first). Meilisearch uses this as its searchableAttributes order;
# Sonic concatenates them.
FIELDS = [
    "title",
    "artist_credit",
    "artist_aliases",
    "release_titles",
    "work_titles",
    "genres",
    "disambiguation",
]

WORD = re.compile(r"\w+", re.UNICODE)


def write_jsonl(path: Path, rows) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", encoding="utf-8") as out:
        for row in rows:
            out.write(json.dumps(row, ensure_ascii=False) + "\n")
            count += 1
    return count


def read_jsonl(path: Path):
    with path.open(encoding="utf-8") as src:
        for line in src:
            if line.strip():
                yield json.loads(line)


def percentile(values: list[float], p: float) -> float:
    """Nearest-rank percentile, the usual definition for latency reports."""
    if not values:
        return math.nan
    ordered = sorted(values)
    rank = max(1, math.ceil(p / 100 * len(ordered)))
    return ordered[rank - 1]
