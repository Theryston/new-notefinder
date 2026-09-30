"""Minimal Sonic client (the protocol is line based, see PROTOCOL.md of the
Sonic repo) and the bulk loader. Collection `mb`, bucket `metadata`, the
MBID as object key, as in the spike and the spec."""

import csv
import multiprocessing
import os
import socket
import sys
import time

from bench.common import EXPORT

COLLECTION = "mb"
BUCKET = "metadata"
MAX_TEXT_BYTES = 18000  # a command line is capped at 20,000 bytes
CONNECTIONS = 8


def escape(text: str) -> str:
    cleaned = " ".join(text.replace("\\", " ").replace('"', " ").split())
    return cleaned


class SonicClient:
    def __init__(self, mode: str, collection: str = COLLECTION, bucket: str = BUCKET):
        self.collection = collection
        self.bucket = bucket
        self.sock = socket.create_connection((os.environ["SONIC_HOST"], 1491))
        self.buf = b""
        self.read_line()  # CONNECTED
        self.send(f"START {mode} {os.environ['SONIC_PASSWORD']}")
        started = self.read_line()
        if not started.startswith("STARTED"):
            raise RuntimeError(started)

    def read_line(self) -> str:
        while b"\n" not in self.buf:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("sonic closed the connection")
            self.buf += chunk
        line, self.buf = self.buf.split(b"\n", 1)
        return line.decode("utf-8").rstrip("\r")

    def send(self, command: str) -> None:
        self.sock.sendall(command.encode("utf-8") + b"\n")

    def command(self, command: str) -> str:
        self.send(command)
        return self.read_line()

    def push(self, mbid: str, text: str) -> None:
        for chunk in chunks(escape(text)):
            reply = self.command(f'PUSH {self.collection} {self.bucket} {mbid} "{chunk}"')
            if reply != "OK":
                raise RuntimeError(f"PUSH {mbid}: {reply}")

    def query(self, text: str, limit: int = 100, offset: int = 0) -> list[str]:
        reply = self.command(f'QUERY {self.collection} {self.bucket} "{escape(text)}" LIMIT({limit}) OFFSET({offset})')
        if not reply.startswith("PENDING"):
            raise RuntimeError(reply)
        event = self.read_line()
        parts = event.split(" ")
        if parts[0] != "EVENT":
            raise RuntimeError(event)
        return [p for p in parts[3:] if p]


def chunks(text: str):
    """Split on word boundaries so each PUSH stays under the command cap."""
    while len(text.encode("utf-8")) > MAX_TEXT_BYTES:
        cut = text.rfind(" ", 0, MAX_TEXT_BYTES // 4)
        cut = cut if cut > 0 else MAX_TEXT_BYTES // 4
        yield text[:cut]
        text = text[cut:].lstrip()
    yield text


def document_text(row: list[str]) -> str:
    # columns: mbid, title, artist_credit, artist_aliases, release_titles,
    # work_titles, genres, disambiguation, stage
    return " ".join(part for part in row[1:-1] if part)


def worker(args: tuple[str, int, str, int | None]) -> int:
    path, index, collection, limit = args
    client = SonicClient("ingest", collection)
    pushed = 0
    with open(path, newline="", encoding="utf-8") as src:
        for n, row in enumerate(csv.reader(src)):
            if limit is not None and n >= limit:
                break
            if n % CONNECTIONS == index:
                client.push(row[0], document_text(row))
                pushed += 1
    return pushed


def load_stage(stage: int, collection: str = COLLECTION, limit: int | None = None) -> None:
    path = str(EXPORT / f"docs-s{stage}.csv")
    started = time.time()
    with multiprocessing.Pool(CONNECTIONS) as pool:
        pushed = sum(pool.map(worker, [(path, i, collection, limit) for i in range(CONNECTIONS)]))
    elapsed = time.time() - started
    print(f"sonic stage {stage}: pushed {pushed} documents in {elapsed:.0f} s ({pushed / elapsed:.0f}/s)")
    sys.stdout.flush()
