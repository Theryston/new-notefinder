"""Build the Recording documents in the MusicBrainz database and export them
as one CSV and one NDJSON file per stage (see sql/build-docs.sql)."""

import csv
import json
import os
import time
from pathlib import Path

import psycopg

from bench.common import EXPORT, FIELDS

SQL = Path(__file__).resolve().parent.parent / "sql" / "build-docs.sql"
COLUMNS = ["mbid", *FIELDS, "stage"]


def build_docs(_args) -> None:
    started = time.time()
    with psycopg.connect(os.environ["MB_DSN"], autocommit=True) as conn:
        conn.execute(SQL.read_text(encoding="utf-8"))
        count = conn.execute("SELECT count(*) FROM bench.doc").fetchone()[0]
    print(f"bench.doc: {count} documents in {time.time() - started:.0f} s")


def export_docs(_args) -> None:
    EXPORT.mkdir(parents=True, exist_ok=True)
    csv_files, json_files, writers = {}, {}, {}
    for stage in range(1, 5):
        csv_files[stage] = (EXPORT / f"docs-s{stage}.csv").open("w", newline="", encoding="utf-8")
        json_files[stage] = (EXPORT / f"docs-s{stage}.ndjson").open("w", encoding="utf-8")
        writers[stage] = csv.writer(csv_files[stage])
    counts = dict.fromkeys(range(1, 5), 0)
    started = time.time()
    with psycopg.connect(os.environ["MB_DSN"]) as conn, conn.cursor(name="export") as cur:
        cur.itersize = 20000
        cur.execute(f"SELECT {', '.join(c if c != 'mbid' else 'mbid::text' for c in COLUMNS)} FROM bench.doc ORDER BY id")
        for row in cur:
            stage = row[-1]
            writers[stage].writerow(["" if v is None else v for v in row])
            doc = {"id": row[0]}
            doc.update({k: v for k, v in zip(FIELDS, row[1:-1]) if v})
            json_files[stage].write(json.dumps(doc, ensure_ascii=False) + "\n")
            counts[stage] += 1
    for handle in [*csv_files.values(), *json_files.values()]:
        handle.close()
    print(f"exported {counts} in {time.time() - started:.0f} s")


def register(sub) -> None:
    sub.add_parser("docs", help="build bench.doc in the MusicBrainz database").set_defaults(func=build_docs)
    sub.add_parser("export", help="export the documents per stage").set_defaults(func=export_docs)
