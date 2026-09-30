"""Query sets, rebuilt with the method of the spike plus the realistic ones
the spike could not test. Everything is deterministic: targets are picked by
`md5(mbid || seed)` and typos by a seeded RNG, so a rerun on the same sample
dump produces the same queries.

Sets (one JSON line each: set, qid, q, mbid, meta):

  random-ta / random-at / random-t   400 Recordings that are on a release;
                                     title + artist, artist + title, title only
  heavy-ta / heavy-at / heavy-t      300 Recordings with a title used at most
                                     20 times by one of five very large artists
  typo                               random-ta with one edit in one word
  prefix-ta / prefix-t               random-ta / random-t with the last word
                                     cut to a prefix (search as you type)
  accent                             400 Recordings with accented letters,
                                     query spelled without accents
  singles                            single common words (latency only)
  warmup                             throwaway queries to warm caches
"""

import os
import random
import string
import unicodedata

import psycopg

from bench.common import QUERIES, WORD, write_jsonl

SEED = "nfbench-68"
RANDOM_N = 400
HEAVY_PER_ARTIST = 60
ACCENT_N = 400
WARMUP_N = 150
HEAVY_ARTISTS = [
    "Bruce Springsteen",
    "Elvis Presley",
    "The Beatles",
    "Bob Dylan",
    "Pink Floyd",
]

# "on a release" = the Recording appears on at least one track.
TARGETS_SQL = """
SELECT d.mbid::text, d.title, d.artist_credit
  FROM bench.doc d
 WHERE EXISTS (SELECT 1 FROM musicbrainz.track t WHERE t.recording = d.id)
   AND d.title ~ '\\w' AND d.artist_credit ~ '\\w'
 ORDER BY md5(d.mbid::text || %(seed)s)
 LIMIT %(n)s
"""

HEAVY_SQL = """
SELECT mbid, title, artist_credit FROM (
  SELECT d.mbid::text AS mbid, d.title, d.artist_credit,
         count(*) OVER (PARTITION BY d.artist_credit, d.title) AS same_title
    FROM bench.doc d
   WHERE d.artist_credit = %(artist)s AND d.title ~ '\\w'
) s
 WHERE same_title <= 20
 ORDER BY md5(mbid || %(seed)s)
 LIMIT %(n)s
"""

ACCENT_SQL = """
SELECT d.mbid::text, d.title, d.artist_credit
  FROM bench.doc d
 WHERE (d.title || d.artist_credit) ~ '[^\\x01-\\x7F]'
   AND d.title ~ '\\w'
 ORDER BY md5(d.mbid::text || %(seed)s)
 LIMIT 6000
"""

# Recordings that share title and artist credit with a target: a hit on one
# of them is as good as a hit on the target (many live takes are identical).
EQUIV_SQL = """
SELECT t.mbid::text, d.mbid::text
  FROM unnest(%(mbids)s::uuid[]) AS t(mbid)
  JOIN bench.doc td ON td.mbid = t.mbid
  JOIN bench.doc d ON lower(d.title) = lower(td.title)
                  AND d.artist_credit = td.artist_credit
                  AND d.mbid <> t.mbid
"""

SINGLES_SQL = """
SELECT word FROM ts_stat($$SELECT to_tsvector('simple', title) FROM bench.doc$$)
 WHERE length(word) >= 2 ORDER BY ndoc DESC LIMIT 1200
"""


def clean(text: str) -> str:
    return " ".join(text.split())


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def add_typo(rng: random.Random, text: str):
    """One edit (substitute, delete, insert, transpose) inside one word of at
    least four letters. Returns (new text, length of the edited word) or None."""
    candidates = [m for m in WORD.finditer(text) if len(m.group()) >= 4 and m.group().isalpha()]
    if not candidates:
        return None
    match = rng.choice(candidates)
    word = match.group()
    pos = rng.randrange(1, len(word) - 1)
    kind = rng.choice(["substitute", "delete", "insert", "transpose"])
    letter = rng.choice(string.ascii_lowercase)
    if kind == "substitute":
        edited = word[:pos] + (letter if letter != word[pos].lower() else "x") + word[pos + 1 :]
    elif kind == "delete":
        edited = word[:pos] + word[pos + 1 :]
    elif kind == "insert":
        edited = word[:pos] + letter + word[pos:]
    else:
        edited = word[:pos] + word[pos + 1] + word[pos] + word[pos + 2 :]
    return text[: match.start()] + edited + text[match.end() :], len(word)


def cut_last_word(text: str):
    """Keep about 60% of the last word (at least 2 letters): a user who has
    typed half of it. None when the word is shorter than 3 characters."""
    found = list(WORD.finditer(text))
    if not found or len(found[-1].group()) < 3:
        return None
    last = found[-1]
    keep = min(len(last.group()) - 1, max(2, round(len(last.group()) * 0.6)))
    return text[: last.start()] + last.group()[:keep]


def query(set_name: str, index: int, text: str, mbid: str, **meta):
    return {"set": set_name, "qid": f"{set_name}-{index}", "q": clean(text), "mbid": mbid, "meta": meta}


def base_sets(prefix: str, rows) -> list[dict]:
    out = []
    for kind, fmt in (("ta", "{t} {a}"), ("at", "{a} {t}"), ("t", "{t}")):
        for i, (mbid, title, artist) in enumerate(rows):
            out.append(query(f"{prefix}-{kind}", i, fmt.format(t=title, a=artist), mbid))
    return out


def derived_sets(rows) -> list[dict]:
    out = []
    for i, (mbid, title, artist) in enumerate(rows):
        rng = random.Random(f"{SEED}:typo:{mbid}")
        typo = add_typo(rng, f"{title} {artist}")
        if typo:
            out.append(query("typo", len(out), typo[0], mbid, typo_word_len=typo[1]))
    for kind, source in (("prefix-ta", lambda t, a: f"{t} {a}"), ("prefix-t", lambda t, a: t)):
        n = 0
        for mbid, title, artist in rows:
            cut = cut_last_word(source(title, artist))
            if cut:
                out.append(query(kind, n, cut, mbid))
                n += 1
    return out


def accent_rows(cur) -> list[tuple]:
    rows = []
    cur.execute(ACCENT_SQL, {"seed": SEED + ":accent"})
    for mbid, title, artist in cur.fetchall():
        folded = clean(fold(f"{title} {artist}"))
        if folded != clean(f"{title} {artist}") and folded.isascii():
            rows.append((mbid, title, artist))
        if len(rows) == ACCENT_N:
            break
    return rows


def heavy_rows(cur) -> list[tuple]:
    rows = []
    for artist in HEAVY_ARTISTS:
        cur.execute(HEAVY_SQL, {"seed": SEED + ":heavy", "artist": artist, "n": HEAVY_PER_ARTIST})
        rows.extend(cur.fetchall())
    return rows


def singles(cur) -> list[dict]:
    cur.execute(SINGLES_SQL)
    ranked = [r[0] for r in cur.fetchall()]
    # The 20 most common words, then words spread over ranks 21..1200.
    picked = ranked[:20] + ranked[20::max(1, (len(ranked) - 20) // 30)][:30]
    return [query("singles", i, w, "", rank=ranked.index(w)) for i, w in enumerate(picked)]


def equivalents(cur, mbids: list[str]) -> dict[str, list[str]]:
    cur.execute(EQUIV_SQL, {"mbids": mbids})
    out: dict[str, list[str]] = {}
    for target, other in cur.fetchall():
        out.setdefault(target, []).append(other)
    return out


def build(_args) -> None:
    with psycopg.connect(os.environ["MB_DSN"], autocommit=True) as conn, conn.cursor() as cur:
        cur.execute(TARGETS_SQL, {"seed": SEED + ":random", "n": RANDOM_N + WARMUP_N})
        pool = cur.fetchall()
        rows, warm = pool[:RANDOM_N], pool[RANDOM_N:]
        heavy, accent = heavy_rows(cur), accent_rows(cur)
        all_queries = (
            base_sets("random", rows)
            + base_sets("heavy", heavy)
            + derived_sets(rows)
            + [query("accent", i, fold(f"{t} {a}"), m) for i, (m, t, a) in enumerate(accent)]
            + [query("warmup", i, f"{t} {a}", m) for i, (m, t, a) in enumerate(warm)]
            + singles(cur)
        )
        targets = sorted({q["mbid"] for q in all_queries if q["mbid"]})
        # Keep every target in stage 1 so each query is answerable at every
        # index size used by the scaling runs.
        cur.execute("UPDATE bench.doc SET stage = 1 WHERE mbid = ANY(%s::uuid[])", (targets,))
        equiv = equivalents(cur, targets)
    QUERIES.mkdir(parents=True, exist_ok=True)
    by_set: dict[str, list[dict]] = {}
    for q in all_queries:
        by_set.setdefault(q["set"], []).append(q)
    for name, items in by_set.items():
        write_jsonl(QUERIES / f"{name}.jsonl", items)
        print(f"{name}: {len(items)} queries")
    write_jsonl(QUERIES / "equivalents.jsonl", ({"mbid": k, "equiv": v} for k, v in equiv.items()))
    print(f"{len(targets)} targets, {len(equiv)} with identical siblings")
    print(f"mean identical siblings per target: {sum(map(len, equiv.values())) / max(1, len(targets)):.1f}")


def register(sub) -> None:
    parser = sub.add_parser("queries", help="build the query sets from the restored sample")
    parser.set_defaults(func=build)
