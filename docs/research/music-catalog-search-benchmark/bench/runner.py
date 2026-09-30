"""Run query sets against one engine, one query at a time, and record the
round-trip latency and the top-100 MBIDs of every query."""

import json
import time

from bench import engines
from bench.common import QUERIES, RESULTS, read_jsonl

ALL_SETS = [
    "random-ta",
    "random-at",
    "random-t",
    "heavy-ta",
    "heavy-at",
    "heavy-t",
    "typo",
    "prefix-ta",
    "prefix-t",
    "accent",
    "singles",
]


def run(args) -> None:
    engine = engines.make(args.engine, args.scope)
    names = ALL_SETS if args.sets == "all" else args.sets.split(",")
    RESULTS.mkdir(parents=True, exist_ok=True)
    if args.warmup:
        for q in list(read_jsonl(QUERIES / "warmup.jsonl"))[: args.warmup]:
            try:
                engine.search(q["q"])
            except Exception as error:  # warm-up failures are not measured
                print(f"warmup error: {error}")
    mode = "a" if args.append else "w"
    with (RESULTS / f"{args.out}.jsonl").open(mode, encoding="utf-8") as out:
        for name in names:
            started = time.time()
            errors = 0
            for q in read_jsonl(QUERIES / f"{name}.jsonl"):
                began = time.perf_counter()
                try:
                    ids, error = engine.search(q["q"]), None
                except Exception as exc:  # recorded, counted, and the run goes on
                    ids, error = [], str(exc)[:200]
                    errors += 1
                    engine = engines.make(args.engine, args.scope)
                elapsed = (time.perf_counter() - began) * 1000
                out.write(json.dumps({"set": name, "qid": q["qid"], "ms": round(elapsed, 2), "ids": ids, "error": error}) + "\n")
            print(f"{args.engine} {name}: {time.time() - started:.0f} s, {errors} errors", flush=True)


def register(sub) -> None:
    parser = sub.add_parser("run", help="run query sets against an engine")
    parser.add_argument("--engine", required=True, choices=["sonic", "meili"])
    parser.add_argument("--sets", default="all", help="comma separated set names or 'all'")
    parser.add_argument("--out", required=True, help="results file name (without extension)")
    parser.add_argument("--scope", default="metadata", choices=["metadata", "lyrics"])
    parser.add_argument("--warmup", type=int, default=150)
    parser.add_argument("--append", action="store_true")
    parser.set_defaults(func=run)
