# Search engine benchmark harness

Harness behind
[`../music-catalog-search-benchmark.md`](../music-catalog-search-benchmark.md)
(issue [#68](https://github.com/Theryston/new-notefinder/issues/68)): tuned
Sonic and Meilisearch on the MusicBrainz sample, same documents, same queries.

It lives in `docs/research/` and is not app code: it is shell, SQL and Python
that run **inside Docker containers**, so nothing is installed on the host and
none of the repo's gates (Biome, tsc, knip, jscpd) sees it. All containers,
volumes and the network are named `nfbench-*`; scratch data goes to
`$BENCH_DIR` (default `~/.cache/nf-bench`), never into the repo.

## Requirements

- Docker. About 15 GB of free disk for the sample (MusicBrainz database about
  13 GB while it exists, exports 3.5 GB, engine indexes 0.6 GB for Sonic and
  11 GB for Meilisearch) and 8 GB of free RAM or more.
- Network access for the sample dump (342 MB), the engine images and the
  tools image build.

## Workflow

Run from this directory. `./run.sh help` lists the commands.

```sh
export BENCH_DIR=$HOME/.cache/nf-bench

# 1. Data: restore the MusicBrainz sample, build the documents and queries
./run.sh build-tools
./run.sh download-sample
./run.sh mb-restore          # mbslave init --empty + import, about 5 min
./run.sh prepare             # documents (sql/build-docs.sql), query sets, exports
./run.sh mb-stop             # the restored database is only needed for `prepare`

# 2. One engine at a time: load in four slices and measure after each
./run.sh sonic-up
./run.sh matrix sonic        # short query sets at 25/50/75%, all sets at 100%
./run.sh meili-up
./run.sh matrix meili        # MEILI_MEMORY=9g ./run.sh meili-up for the warm run

# 3. Reports and extra experiments
./run.sh bench report --results sonic-s4
./run.sh bench throughput --engine meili --clients 16 --seconds 30
./run.sh bench ops-updates --engine meili
./run.sh bench ops-bluegreen --engine meili --docs 200000
./run.sh bench lyrics-gen --count 50000
./run.sh bench lyrics-load --engine meili
./run.sh bench run --engine meili --scope lyrics --sets lyrics-line --out meili-lyrics
./run.sh mem nfbench-meili   # memory of a container, from the cgroup
./run.sh du nfbench-meili .  # bytes on disk of a volume

# 4. Remove containers, volumes and the network
./run.sh clean               # then delete $BENCH_DIR by hand
```

Results go to `$BENCH_DIR/results/<name>.jsonl` (one line per query: latency
and the top-100 MBIDs). `bench report` turns one into the markdown tables of
the findings document.

## What is where

| Path | What |
| --- | --- |
| `run.sh` | Container lifecycle, the measurement loop (`matrix`), memory and disk probes. Sonic and Meilisearch configuration is here. |
| `Dockerfile` | Tools image: Python 3.13, `psql`, psycopg and mbslave `v31.0.1` from git (PyPI is stale). |
| `sql/build-docs.sql` | One document per Recording, fields kept apart (title, artist credit, aliases, releases, Works, genres, disambiguation). |
| `bench/queries.py` | Query sets (random, heavy artists, typo, prefix, accent-free, single words) and the lists of identical Recordings. Deterministic. |
| `bench/export.py`, `loaders.py`, `sonic.py`, `meili.py` | Export in four slices and the bulk loaders. |
| `bench/runner.py`, `engines.py`, `report.py` | Run sets one query at a time, recall (strict and "any identical") and latency percentiles. |
| `bench/throughput.py`, `ops.py`, `writers.py` | Concurrent clients, incremental updates, blue-green build and swap. |
| `bench/lyrics.py` | Synthetic Lyrics (no real lyrics are used or published). |

## Things to know before rerunning

- **Sonic must be restarted after a bulk load** (`matrix` does it): unflushed
  RocksDB memtables make reads about ten times slower. Do not re-push
  Recordings between measurements: a re-pushed Recording jumps ahead of its
  twins among equal scores.
- `ops-updates` rewrites the first 2,200 Recordings of slice 4 and writes the
  originals back; it never touches a query target (targets are all in slice
  1). Reload the engine if you want a perfectly clean index afterwards.
- Meilisearch's file never shrinks, so its size depends on how the index was
  built (incremental slices here). Compare `usedIndexSize` from
  `GET /indexes/recordings/stats` as well as the file size.
- To run at full scale (issue #58): restore the full export with
  `mbslave import` of the two archives instead of the sample (the spike's
  section 3 has the list), expect `prepare` to take hours and the exports to be
  about 14 times larger, and raise the container memory limits in `run.sh`.
  None of this was run **[unverified]**.
- The Postgres full-text variants of the ticket (`tsvector` + GIN, prefix,
  `pg_trgm`) are not in the harness: that measurement was skipped by decision.
  Adding one means an adapter with `search(text) -> [mbid]` in `bench/engines.py`
  and a loader in `bench/loaders.py`.
