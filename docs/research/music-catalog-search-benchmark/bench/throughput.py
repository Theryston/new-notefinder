"""Concurrent load: N clients, each with its own connection, cycling through
one query set for a fixed time. Reports queries per second and latency."""

import multiprocessing
import time

from bench import engines
from bench.common import QUERIES, percentile, read_jsonl


def client(args: tuple[str, str, int, float]) -> list[float]:
    engine_name, set_name, offset, seconds = args
    engine = engines.make(engine_name)
    texts = [q["q"] for q in read_jsonl(QUERIES / f"{set_name}.jsonl")]
    times, n = [], offset * 37  # different starting point per client
    deadline = time.time() + seconds
    while time.time() < deadline:
        began = time.perf_counter()
        engine.search(texts[n % len(texts)])
        times.append((time.perf_counter() - began) * 1000)
        n += 1
    return times


def run(args) -> None:
    jobs = [(args.engine, args.set, i, args.seconds) for i in range(args.clients)]
    with multiprocessing.Pool(args.clients) as pool:
        per_client = pool.map(client, jobs)
    times = [t for client_times in per_client for t in client_times]
    print(
        f"{args.engine} {args.set}: {args.clients} clients, {len(times) / args.seconds:.0f} queries/s, "
        f"p50 {percentile(times, 50):.1f} / p95 {percentile(times, 95):.1f} / "
        f"p99 {percentile(times, 99):.1f} ms ({len(times)} queries)"
    )


def register(sub) -> None:
    parser = sub.add_parser("throughput", help="N concurrent clients on one query set")
    parser.add_argument("--engine", required=True)
    parser.add_argument("--set", default="random-ta")
    parser.add_argument("--clients", type=int, default=8)
    parser.add_argument("--seconds", type=float, default=30)
    parser.set_defaults(func=run)
