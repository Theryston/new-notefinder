"""Write one changed Recording document to an engine, the way the outbox
worker would: the whole document again, not just the changed field."""

import csv
import json

from bench import meili, sonic
from bench.common import EXPORT, FIELDS


def rows(count: int) -> list[dict]:
    """The first Recordings of stage 4 with all their fields. Stage 4 never
    holds a query target, so updating them cannot change a recall figure."""
    out = []
    with open(EXPORT / "docs-s4.csv", newline="", encoding="utf-8") as src:
        for values in csv.reader(src):
            out.append({"mbid": values[0], **dict(zip(FIELDS, values[1:-1], strict=True))})
            if len(out) == count:
                break
    return out


def renamed(row: dict, word: str) -> dict:
    return {**row, "title": f"{word} {row['title']}"}


class SonicWriter:
    def __init__(self):
        self.client = sonic.SonicClient("ingest")

    def update(self, row: dict) -> None:
        # No UPDATE command: drop the object, push it again.
        self.client.command(f"FLUSHO {sonic.COLLECTION} {sonic.BUCKET} {row['mbid']}")
        self.client.push(row["mbid"], " ".join(row[f] for f in FIELDS if row[f]))

    def update_many(self, batch: list[dict]) -> None:
        for row in batch:
            self.update(row)


class MeiliWriter:
    def __init__(self):
        self.client = meili.MeiliClient()

    def submit(self, batch: list[dict]) -> int:
        body = "".join(
            json.dumps({"id": r["mbid"], **{f: r[f] for f in FIELDS if r[f]}}) + "\n" for r in batch
        ).encode()
        task = self.client.request(
            "POST", f"/indexes/{meili.INDEX}/documents", body, "application/x-ndjson"
        )
        return task["taskUid"]

    def update(self, row: dict) -> None:
        self.submit([row])

    def update_many(self, batch: list[dict]) -> None:
        self.client.wait(self.submit(batch), poll=0.2)


def make(engine: str):
    return {"sonic": SonicWriter, "meili": MeiliWriter}[engine]()
