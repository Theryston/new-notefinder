"""Operational experiments on a fully loaded engine:

  ops-updates     incremental updates, as the outbox worker would send them:
                  one Recording at a time (time to write, time until a search
                  finds the new text) and a burst of 2,000 (docs per second),
                  plus the effect of the burst on query latency
  ops-bluegreen   build a second index from part of stage 1 while a client
                  keeps querying the live one; then swap (Meilisearch has an
                  atomic swap, Sonic has none)
"""

import multiprocessing
import time

from bench import engines, meili, sonic, writers
from bench.common import EXPORT, QUERIES, percentile, read_jsonl

UPDATES_SINGLE = 200
UPDATES_BURST = 2000


def token(i: int) -> str:
    """A nonsense word no Recording contains, unique per update."""
    letters = "abcdefghij"
    return "zq" + "".join(letters[int(d)] for d in str(i)) + "xw"


def wait_visible(reader, mbid: str, word: str, timeout: float = 30.0) -> float:
    began = time.perf_counter()
    while time.perf_counter() - began < timeout:
        if reader.search(word)[:1] == [mbid]:
            return (time.perf_counter() - began) * 1000
        time.sleep(0.005)
    return float("nan")


def query_latency(reader, texts: list[str]) -> str:
    times = []
    for text in texts:
        began = time.perf_counter()
        reader.search(text)
        times.append((time.perf_counter() - began) * 1000)
    return f"p50 {percentile(times, 50):.1f} / p95 {percentile(times, 95):.1f} ms"


def updates(args) -> None:
    reader, writer = engines.make(args.engine), writers.make(args.engine)
    docs = writers.rows(UPDATES_SINGLE + UPDATES_BURST)
    texts = [q["q"] for q in read_jsonl(QUERIES / "random-ta.jsonl")][:200]
    print(f"{args.engine} query latency before updates: {query_latency(reader, texts)}")
    write_ms, visible_ms = [], []
    for i, row in enumerate(docs[:UPDATES_SINGLE]):
        word = token(i)
        began = time.perf_counter()
        writer.update(writers.renamed(row, word))
        write_ms.append((time.perf_counter() - began) * 1000)
        visible_ms.append(write_ms[-1] + wait_visible(reader, row["mbid"], word))
    for label, values in (("write call returns", write_ms), ("new text searchable", visible_ms)):
        print(
            f"{args.engine} single update, {label}: p50 {percentile(values, 50):.1f} / "
            f"p95 {percentile(values, 95):.1f} / max {max(values):.1f} ms ({len(values)} updates)"
        )
    burst = [writers.renamed(r, token(1000 + i)) for i, r in enumerate(docs[UPDATES_SINGLE:])]
    began = time.perf_counter()
    writer.update_many(burst)
    took = time.perf_counter() - began
    print(f"{args.engine} burst of {len(burst)} updates done in {took:.1f} s ({len(burst) / took:.0f} docs/s)")
    print(f"{args.engine} query latency after the burst: {query_latency(reader, texts)}")
    writer.update_many(docs)  # put the original documents back


def reader_loop(engine_name: str, stop, out) -> None:
    reader = engines.make(engine_name)
    texts = [q["q"] for q in read_jsonl(QUERIES / "random-ta.jsonl")]
    samples, n = [], 0
    while not stop.is_set():
        began = time.time()
        reader.search(texts[n % len(texts)])
        samples.append((began, (time.time() - began) * 1000))
        n += 1
    out.put(samples)


def phase_stats(samples, start: float, end: float) -> str:
    times = [ms for t, ms in samples if start <= t < end]
    if not times:
        return "no queries"
    return (
        f"{len(times)} queries, p50 {percentile(times, 50):.1f} / "
        f"p95 {percentile(times, 95):.1f} / p99 {percentile(times, 99):.1f} / max {max(times):.0f} ms"
    )


def build_next(engine: str, docs: int | None) -> None:
    """Build a second index next to the live one from the first `docs`
    Recordings of stage 1 (all of stage 1 when None)."""
    if engine == "sonic":
        sonic.load_stage(1, "mb_next", limit=docs)
        return
    client = meili.MeiliClient()
    for step in (
        lambda: client.request("POST", "/indexes", {"uid": "recordings_next", "primaryKey": "id"}),
        lambda: client.request(
            "PUT", "/indexes/recordings_next/settings/searchable-attributes", list(meili.FIELDS)
        ),
    ):
        client.wait(step()["taskUid"])
    uids, batch = [], []
    with open(EXPORT / "docs-s1.ndjson", encoding="utf-8") as src:
        for n, line in enumerate(src):
            if docs is not None and n >= docs:
                break
            batch.append(line)
            if len(batch) == meili.CHUNK_DOCS:
                uids.append(post_docs(client, batch))
                batch = []
    if batch:
        uids.append(post_docs(client, batch))
    for uid in uids:
        client.wait(uid, poll=1.0)


def post_docs(client, batch: list[str]) -> int:
    task = client.request(
        "POST", "/indexes/recordings_next/documents", "".join(batch).encode(), "application/x-ndjson"
    )
    return task["taskUid"]


def swap_meili() -> float:
    client = meili.MeiliClient()
    began = time.perf_counter()
    task = client.request("POST", "/swap-indexes", [{"indexes": ["recordings", "recordings_next"]}])
    client.wait(task["taskUid"], poll=0.05)
    return (time.perf_counter() - began) * 1000


def cleanup_next(engine: str) -> None:
    if engine == "sonic":
        began = time.perf_counter()
        sonic.SonicClient("ingest").command("FLUSHC mb_next")
        print(f"sonic FLUSHC of the second collection took {(time.perf_counter() - began) * 1000:.0f} ms")
    else:
        client = meili.MeiliClient()
        client.wait(client.request("DELETE", "/indexes/recordings_next")["taskUid"])


def bluegreen(args) -> None:
    stop, out = multiprocessing.Event(), multiprocessing.Queue()
    process = multiprocessing.Process(target=reader_loop, args=(args.engine, stop, out))
    process.start()
    time.sleep(20)
    build_start = time.time()
    build_next(args.engine, args.docs)
    build_end = time.time()
    swap_ms = swap_meili() if args.engine == "meili" else None
    swap_end = time.time()
    time.sleep(20)
    stop.set()
    samples = out.get()
    process.join()
    label = f"{args.docs} documents" if args.docs else "all of stage 1"
    print(f"{args.engine} build of the second index ({label}) took {build_end - build_start:.0f} s")
    print(f"{args.engine} queries before the build: {phase_stats(samples, build_start - 20, build_start)}")
    print(f"{args.engine} queries during the build:  {phase_stats(samples, build_start, build_end)}")
    print(f"{args.engine} queries around/after swap: {phase_stats(samples, build_end, swap_end + 20)}")
    if swap_ms is None:
        print("sonic: no swap operation (the application switches collection name)")
    else:
        print(f"meili swap-indexes took {swap_ms:.0f} ms")
        swap_meili()  # swap back: the live index is the full one again
    cleanup_next(args.engine)


def register(sub) -> None:
    for name, func, text in (
        ("ops-updates", updates, "incremental update latency and throughput"),
        ("ops-bluegreen", bluegreen, "build a second index while the first serves"),
    ):
        parser = sub.add_parser(name, help=text)
        parser.add_argument("--engine", required=True, choices=["sonic", "meili"])
        if name == "ops-bluegreen":
            parser.add_argument("--docs", type=int, default=None, help="documents in the second index")
        parser.set_defaults(func=func)
