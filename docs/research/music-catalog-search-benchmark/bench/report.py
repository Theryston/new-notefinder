"""Turn a results file into the tables of the findings document."""

import statistics

from bench.common import QUERIES, RESULTS, percentile, read_jsonl


def load_equivalents() -> dict[str, set[str]]:
    return {r["mbid"]: set(r["equiv"]) for r in read_jsonl(QUERIES / "equivalents.jsonl")}


def rank_of(ids: list[str], accept: set[str]) -> int | None:
    for position, mbid in enumerate(ids, start=1):
        if mbid in accept:
            return position
    return None


def share(ranks: list[int | None], at: int) -> float:
    return 100 * sum(1 for r in ranks if r is not None and r <= at) / max(1, len(ranks))


def summarize(rows: list[dict], queries: dict[str, dict], equiv: dict[str, set[str]]) -> dict:
    strict, loose = [], []
    for row in rows:
        target = queries[row["qid"]]["mbid"]
        strict.append(rank_of(row["ids"], {target}))
        loose.append(rank_of(row["ids"], {target} | equiv.get(target, set())))
    times = [r["ms"] for r in rows]
    return {
        "n": len(rows),
        "empty": 100 * sum(1 for r in rows if not r["ids"]) / max(1, len(rows)),
        "errors": sum(1 for r in rows if r["error"]),
        "strict": [share(strict, k) for k in (1, 10, 100)],
        "loose": [share(loose, k) for k in (1, 10, 100)],
        "lat": [percentile(times, p) for p in (50, 95, 99)] + [max(times, default=0)],
    }


def fmt_ms(value: float) -> str:
    return f"{value:,.0f}" if value >= 100 else f"{value:.1f}"


def line(name: str, s: dict) -> str:
    strict = " / ".join(f"{v:.1f}" for v in s["strict"])
    loose = " / ".join(f"{v:.1f}" for v in s["loose"])
    lat = " / ".join(fmt_ms(v) for v in s["lat"][:3])
    return f"| {name} | {s['n']} | {s['empty']:.1f}% | {strict} | {loose} | {lat} | {fmt_ms(s['lat'][3])} |"


def report(args) -> None:
    results = list(read_jsonl(RESULTS / f"{args.results}.jsonl"))
    equiv = load_equivalents()
    print("| set | n | empty | recall@1/10/100 (strict) | recall@1/10/100 (any identical) | p50 / p95 / p99 ms | max ms |")
    print("| --- | --- | --- | --- | --- | --- | --- |")
    for name in dict.fromkeys(r["set"] for r in results):
        queries = {q["qid"]: q for q in read_jsonl(QUERIES / f"{name}.jsonl")}
        rows = [r for r in results if r["set"] == name]
        if name == "singles":
            times = [r["ms"] for r in rows]
            counts = [len(r["ids"]) for r in rows]
            print(
                f"| singles (latency only) | {len(rows)} | {100 * sum(1 for c in counts if c == 0) / len(rows):.1f}% | "
                f"n/a | n/a | {' / '.join(fmt_ms(percentile(times, p)) for p in (50, 95, 99))} | {fmt_ms(max(times))} |"
            )
            continue
        print(line(name, summarize(rows, queries, equiv)))
        if name == "typo":
            long_words = [r for r in rows if queries[r["qid"]]["meta"]["typo_word_len"] >= 5]
            print(line("typo, edited word >= 5 letters", summarize(long_words, queries, equiv)))
    if args.verbose:
        print(f"median results per query: {statistics.median(len(r['ids']) for r in results)}")


def register(sub) -> None:
    parser = sub.add_parser("report", help="summarize a results file as markdown tables")
    parser.add_argument("--results", required=True)
    parser.add_argument("--verbose", action="store_true")
    parser.set_defaults(func=report)
