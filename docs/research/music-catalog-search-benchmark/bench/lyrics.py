"""The Lyrics index, on synthetic text.

The LRCLIB dump (47.6 GB) cannot be used here, and real lyrics must not be
published or redistributed, so the harness writes lyrics-shaped text instead:
about 1 KB per song (27 lines of 7 words, a four-line chorus repeated three
times), with words drawn from the real frequency distribution of the
sample's Recording titles. The distribution is Zipf-like like any natural
text, which is what index size and posting-list lengths depend on; what it
does not reproduce is the repetition and rhyme of real lyrics [unverified].

Each lyric is attached to a real Recording MBID (the first ones of stage 1).
The query set `lyrics-line` has one query per sampled song: five consecutive
words of one of its lines, the expected answer being that song.
"""

import bisect
import csv
import itertools
import json
import random
import re
import time
from collections import Counter

from bench import meili, sonic
from bench.common import EXPORT, QUERIES, read_jsonl, write_jsonl

SEED = "nfbench-68-lyrics"
VOCABULARY = 30000
WORD_RE = re.compile(r"[a-z]+")
LINES = 25
WORDS_PER_LINE = 7
CHORUS_LINES = 4
QUERY_COUNT = 300
QUERY_WORDS = 5

def draw_lines(rng: random.Random, words: list[str], cumulative: list[int]) -> list[str]:
    total = cumulative[-1]

    def line() -> str:
        picks = (bisect.bisect(cumulative, rng.randrange(total)) for _ in range(WORDS_PER_LINE))
        return " ".join(words[i] for i in picks)

    verse = [line() for _ in range(LINES - 3 * CHORUS_LINES)]
    chorus = [line() for _ in range(CHORUS_LINES)]
    return verse[:4] + chorus + verse[4:] + chorus + verse[:2] + chorus


def vocabulary_and_mbids(count: int) -> tuple[list[tuple[str, int]], list[str]]:
    """Word frequencies of the Recording titles of stage 1, and the MBIDs of
    its first `count` Recordings."""
    freq: Counter[str] = Counter()
    mbids = []
    with open(EXPORT / "docs-s1.csv", newline="", encoding="utf-8") as src:
        for row in csv.reader(src):
            freq.update(WORD_RE.findall(row[1].lower()))
            if len(mbids) < count:
                mbids.append(row[0])
    return freq.most_common(VOCABULARY), mbids


def generate(args) -> None:
    vocab, mbids = vocabulary_and_mbids(args.count)
    words = [w for w, _ in vocab]
    cumulative = list(itertools.accumulate(n for _, n in vocab))
    rng = random.Random(SEED)
    EXPORT.mkdir(parents=True, exist_ok=True)
    started = time.time()
    songs = [(mbid, draw_lines(rng, words, cumulative)) for mbid in mbids]
    write_jsonl(EXPORT / "lyrics.jsonl", ({"mbid": m, "text": " ".join(lines)} for m, lines in songs))
    size = (EXPORT / "lyrics.jsonl").stat().st_size
    print(f"{len(songs)} lyrics, {size / 1e6:.0f} MB, {size / len(songs):.0f} bytes each, {time.time() - started:.0f} s")
    picks = random.Random(SEED + ":queries").sample(songs, QUERY_COUNT)
    queries = []
    for i, (mbid, lines) in enumerate(picks):
        line = rng.choice(lines).split()[:QUERY_WORDS]
        queries.append({"set": "lyrics-line", "qid": f"lyrics-line-{i}", "q": " ".join(line), "mbid": mbid, "meta": {}})
    write_jsonl(QUERIES / "lyrics-line.jsonl", queries)


def load(args) -> None:
    started = time.time()
    if args.engine == "sonic":
        push_sonic()
    else:
        push_meili()
    print(f"{args.engine} lyrics indexed in {time.time() - started:.0f} s")


def push_sonic() -> None:
    client = sonic.SonicClient("ingest")
    for row in read_jsonl(EXPORT / "lyrics.jsonl"):
        for chunk in sonic.chunks(sonic.escape(row["text"])):
            reply = client.command(f'PUSH {sonic.COLLECTION} lyrics {row["mbid"]} "{chunk}"')
            if reply != "OK":
                raise RuntimeError(reply)


def push_meili() -> None:
    client = meili.MeiliClient()
    try:
        client.request("GET", "/indexes/lyrics")
    except RuntimeError:
        client.wait(client.request("POST", "/indexes", {"uid": "lyrics", "primaryKey": "id"})["taskUid"])
        client.wait(client.request("PUT", "/indexes/lyrics/settings/searchable-attributes", ["text"])["taskUid"])
    uids, batch = [], []
    for row in read_jsonl(EXPORT / "lyrics.jsonl"):
        batch.append(row)
        if len(batch) == 50000:
            uids.append(post(client, batch))
            batch = []
    if batch:
        uids.append(post(client, batch))
    for uid in uids:
        client.wait(uid, poll=2.0)


def post(client, rows: list[dict]) -> int:
    body = "".join(json.dumps({"id": r["mbid"], "text": r["text"]}) + "\n" for r in rows).encode()
    return client.request("POST", "/indexes/lyrics/documents", body, "application/x-ndjson")["taskUid"]


def register(sub) -> None:
    parser = sub.add_parser("lyrics-gen", help="write synthetic lyrics and the lyrics-line query set")
    parser.add_argument("--count", type=int, default=50000)
    parser.set_defaults(func=generate)
    parser = sub.add_parser("lyrics-load", help="index the synthetic lyrics in one engine")
    parser.add_argument("--engine", required=True, choices=["sonic", "meili"])
    parser.set_defaults(func=load)
