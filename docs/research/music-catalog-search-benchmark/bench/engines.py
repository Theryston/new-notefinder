"""One `search(text) -> [mbid, ...]` adapter per engine, so the runner
measures every engine the same way: one query at a time, top 100, wall-clock
round trip from the harness container."""

from bench.meili import MeiliClient
from bench.sonic import SonicClient

LIMIT = 100


class Sonic:
    name = "sonic"

    def __init__(self, scope: str = "metadata"):
        self.client = SonicClient("search", bucket=scope)

    def search(self, text: str) -> list[str]:
        return self.client.query(text, LIMIT)


class Meili:
    name = "meili"

    def __init__(self, scope: str = "metadata"):
        self.client = MeiliClient("lyrics" if scope == "lyrics" else "recordings")

    def search(self, text: str) -> list[str]:
        return self.client.search(text, LIMIT)


def make(engine: str, scope: str = "metadata"):
    if engine == "sonic":
        return Sonic(scope)
    if engine == "meili":
        return Meili(scope)
    raise SystemExit(f"unknown engine {engine}")
