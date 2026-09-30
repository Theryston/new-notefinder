"""Meilisearch client (plain HTTP) and the bulk loader. One index,
`recordings`, searchable attributes in the order of the spec's metadata
fields; every other setting is left at its default (typo tolerance, prefix
search, ranking rules, matching strategy)."""

import http.client
import json
import os
import re
import time
from urllib.parse import urlparse

from bench.common import EXPORT, FIELDS

INDEX = "recordings"
CHUNK_DOCS = 100_000


class MeiliClient:
    def __init__(self, index: str = INDEX):
        self.index = index
        url = urlparse(os.environ["MEILI_URL"])
        self.conn = http.client.HTTPConnection(url.hostname, url.port, timeout=600)
        self.headers = {"Authorization": f"Bearer {os.environ['MEILI_KEY']}"}

    def request(self, method: str, path: str, body=None, content_type="application/json"):
        payload = body if isinstance(body, bytes) else (json.dumps(body).encode() if body is not None else None)
        headers = dict(self.headers)
        if payload is not None:
            headers["Content-Type"] = content_type
        self.conn.request(method, path, payload, headers)
        response = self.conn.getresponse()
        data = response.read()
        if response.status >= 400:
            raise RuntimeError(f"{method} {path}: {response.status} {data[:300]!r}")
        return json.loads(data) if data else None

    def search(self, text: str, limit: int = 100) -> list[str]:
        result = self.request(
            "POST",
            f"/indexes/{self.index}/search",
            {"q": text, "limit": limit, "attributesToRetrieve": ["id"]},
        )
        return [hit["id"] for hit in result["hits"]]

    def wait(self, task_uid: int, poll: float = 2.0) -> dict:
        while True:
            task = self.request("GET", f"/tasks/{task_uid}")
            if task["status"] in ("succeeded", "failed", "canceled"):
                if task["status"] != "succeeded":
                    raise RuntimeError(f"task {task_uid}: {task.get('error')}")
                return task
            time.sleep(poll)


def iso_seconds(duration: str) -> float:
    """Meilisearch reports task duration as an ISO 8601 string like PT12.3S."""
    match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?", duration)
    hours, minutes, seconds = (float(g or 0) for g in match.groups())
    return hours * 3600 + minutes * 60 + seconds


def configure(client: MeiliClient) -> None:
    try:
        client.request("GET", f"/indexes/{INDEX}")
        return
    except RuntimeError:
        pass
    task = client.request("POST", "/indexes", {"uid": INDEX, "primaryKey": "id"})
    client.wait(task["taskUid"])
    task = client.request("PUT", f"/indexes/{INDEX}/settings/searchable-attributes", FIELDS)
    client.wait(task["taskUid"])


def load_stage(stage: int) -> None:
    client = MeiliClient()
    configure(client)
    started = time.time()
    uids, batch, count = [], [], 0

    def flush():
        nonlocal batch
        if batch:
            task = client.request(
                "POST",
                f"/indexes/{INDEX}/documents",
                "".join(batch).encode("utf-8"),
                "application/x-ndjson",
            )
            uids.append(task["taskUid"])
            batch = []

    with open(EXPORT / f"docs-s{stage}.ndjson", encoding="utf-8") as src:
        for line in src:
            batch.append(line)
            count += 1
            if len(batch) == CHUNK_DOCS:
                flush()
    flush()
    print(f"meili stage {stage}: enqueued {count} documents in {len(uids)} tasks")
    for uid in uids:
        client.wait(uid, poll=5.0)
    elapsed = time.time() - started
    work = sum(iso_seconds(client.request("GET", f"/tasks/{u}")["duration"]) for u in uids)
    print(f"meili stage {stage}: indexed in {elapsed:.0f} s wall clock ({work:.0f} s of task time)")
