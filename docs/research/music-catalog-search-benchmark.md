# Music catalog search engine benchmark: tuned Sonic vs Meilisearch

Findings for [#68](https://github.com/Theryston/new-notefinder/issues/68), a
ticket of the Music catalog spec
([#55](https://github.com/Theryston/new-notefinder/issues/55)). Work done on
2026-09-30, after the spike ([#56](https://github.com/Theryston/new-notefinder/issues/56),
`docs/research/music-catalog-spike.md`). Vocabulary (Music catalog, Recording,
Lyrics) is the one defined in `CONTEXT.md`. The harness that produced every
number is committed next to this file in
[`music-catalog-search-benchmark/`](music-catalog-search-benchmark/README.md).

## How to read this document

Every claim carries one of these labels, as in the spike:

- **[source]**: read in a primary source (linked next to it).
- **[measured]**: measured by running the thing on the MusicBrainz sample
  (how, in [Method and environment](#method-and-environment)).
- **[extrapolated]**: computed from a measurement or a source number, with the
  formula stated. Treat as an estimate.
- **[unverified]**: could not be checked. Not a claim.
- **[source: spike]**: a number taken from the spike document, not re-measured
  here.

## Scope: what was run and what was not

The ticket asked for three engines, a full-scale extrapolation and a
blue-green check. The maintainer narrowed the run while it was in progress, so
this document covers:

| Ticket item | What was done |
| --- | --- |
| Sonic (tuned), Meilisearch | **Measured** on the MusicBrainz sample (2,948,134 Recordings), same query sets for both. |
| Postgres full-text search | **Not re-run, by decision.** The spike's calibration numbers are quoted as **[source: spike]** in the tables that can use them. No `pg_trgm` or prefix variant was built or measured, so nothing here says how Postgres handles typos or prefixes **[unverified]**. |
| Scale or stress test | **Skipped, by decision.** The sample was never multiplied. Full-dataset figures (40.4 M Recordings plus Lyrics) are **[extrapolated]** by calculation from the sample measurements. |
| Growth curve | Each engine was loaded with the sample in four equal slices (25%, 50%, 75%, 100%, one copy of the data, nothing duplicated) and queried after each slice, to see how latency moves inside the sample. |

Nothing was downloaded except the sample dump the spike used, the engine and
helper images, and the packages of the tools image. Nothing in the repo
changed except this document and the harness.

## Summary

Same 2,948,134 documents, same queries, one query at a time, top 100. Sonic
has the spike's recommended configuration; Meilisearch v1.54.2 has its default
typo and prefix settings.

| | Sonic v1.10.1 (tuned) | Meilisearch v1.54.2 | Postgres full-text [source: spike] |
| --- | --- | --- | --- |
| recall@10, title + artist, random Recordings | 84.8% (95.8% counting identical Recordings) | **95.8%** (97.8%) | 91.2% (other draw of the same set) |
| recall@10, title only | 49.8% (58.2%) | **90.8%** (93.2%) | 66.8% (other draw) |
| recall@10, one typo in a word of 5+ letters | 79.3% (87.1%) | **94.7%** (95.6%) | no typo matching [source: spike] |
| recall@10, last word cut (search as you type) | 78.4% (88.1%) | **95.6%** (97.7%) | no prefix matching in the measured variant [source: spike] |
| latency p95, title + artist | 815 ms | **22 ms** with the index in RAM, 97 ms RAM-limited | 29 ms (other draw) |
| latency p99, title + artist | 1,324 ms | **65 ms** with the index in RAM, 158 ms RAM-limited | 88 ms (other draw) |
| queries per second, 16 clients | 18 | **797** | not measured |
| index on disk, sample | **0.61 GB** | 10.9 GB file (5.8 GB of data) | 2.0 GB (table 1.8 + GIN 0.2) |
| time to index the sample | **221 s** of pushes | about 14 min | 112 s to load, per the spike |
| update of one Recording, searchable after | **9 ms** | 387 ms (p95 1.1 s) | not measured |
| atomic swap for blue-green | no | **yes, 103 ms** | not measured |
| full dataset index, [extrapolated] | **about 8 GB** | 79 to 149 GB | about 27 GB |
| Lyrics index per song (synthetic), [measured] | **0.5 KB** | 10.7 KB | not measured |

How to read the table: Meilisearch is the clear winner on search quality and
speed at every size tested; Sonic as tuned is the smallest and the cheapest to
update but misses the right Recording far more often and its tail latency is
seconds at 2.95 M; Postgres, from the spike's idealized calibration, sits
between them on quality and is the cheapest to operate because it is already in the stack. The real cost of
Meilisearch is **disk**: about 3.7 KB per Recording on disk in this run, which
is 79 to 149 GB for 40.4 M Recordings plus the same again during a blue-green
reimport, and another 43 to 150 GB if the Lyrics go to the same engine.

**Recommendation (the maintainer decides):** use **Meilisearch** for the
metadata search if the disk budget above is acceptable, keep the Postgres
full-text option (already in the stack, smallest footprint) as the fallback if
it is not, and do not use Sonic as tuned. Details and the open decisions are
in [Recommendation](#recommendation-and-decisions-for-the-maintainer).

## Method and environment

### Hardware and software **[measured]**

One developer laptop used for everything else too (a desktop session was
running, 7 to 12 GiB of the 15 GiB were free during the runs), so absolute
times are indicative:

| Piece | Value |
| --- | --- |
| CPU | AMD Ryzen 7 5700X, 8 cores / 16 threads |
| RAM | 15 GiB (+ 31 GiB swap) |
| Disk | SATA SSD (`sda`, 447 GB, non-rotational). The spike's text says NVMe for its machine; this run was **not** on NVMe |
| OS / Docker | Linux 7.2.5, Docker 29.7.2 |
| Sonic | `valeriansaliou/sonic:v1.10.1`, container limit 4 GiB, configuration below |
| Meilisearch | `getmeili/meilisearch:v1.54.2` (published 2026-09-29, the latest stable release, [releases](https://github.com/meilisearch/meilisearch/releases)); `MEILI_ENV=production`, `MEILI_MAX_INDEXING_MEMORY=3GiB`, payload limit raised to 500 MB; container limit 6 GiB, 9 GiB for the "index in RAM" runs |
| MusicBrainz | Sample dump of 2026-09-01, restored with mbslave `v31.0.1` (`init --empty` + `import`, as in the spike): 2,948,134 Recordings |
| Harness | Python 3.13 in a container on the same Docker network, one client, round trip measured around each call |

### Documents

One document per Recording, built from the restored sample with the spike's
query, split into the fields of the spec: `title`, `artist_credit` (as
MusicBrainz displays it, with join phrases), `artist_aliases` (artist names,
sort names and aliases), `release_titles`, `work_titles`, `genres`,
`disambiguation`. Sonic receives the fields concatenated (it has no fields);
Meilisearch keeps them and uses them as `searchableAttributes` in that order;
the MBID is the object key / primary key in both. **[measured]** 1.76 GB of CSV
(about 600 bytes per Recording), 801 bytes per document as JSON in Meilisearch.

### Engine configuration

**Sonic** (the spike's recommendation, section 7 of the spike): `detect_special_patterns=false`,
`diacritic_folding_enabled=true`, `retain_word_objects=1,000,000`, and the
bulk-load RocksDB settings (256 MiB write buffer, 4 buffers, 8 background jobs,
level-0 triggers 8 / 48 / 64). Default FST graph caps. One change to the
measurement procedure, found during the run and explained in
[Sonic needs a restart after a bulk load](#sonic-needs-a-restart-after-a-bulk-load):
Sonic is restarted after each load, before any query.

**Meilisearch**: `searchableAttributes` = the seven fields above; **everything
else is the default**: typo tolerance (one typo from 5 letters, two from 9
**[source]** [typo tolerance](https://www.meilisearch.com/docs/learn/relevancy/typo_tolerance_settings)),
prefix search on the last word (`indexingTime`, **[source]**
[prefix search](https://www.meilisearch.com/docs/learn/relevancy/prefix_search)),
`matchingStrategy: last` (**[source]** [search API](https://www.meilisearch.com/docs/reference/api/search/search-with-post)),
default ranking rules. Searches ask for `limit: 100` and only the `id`.

### Query sets

Rebuilt with the spike's method (targets picked by `md5(mbid || seed)`, so the
same sample gives the same queries) plus the ones the spike could not test. Each
query is built from a real Recording; the expected answer is its MBID.

| Set | n | Built from |
| --- | --- | --- |
| `random-ta` / `random-at` / `random-t` | 400 | Recordings that are on a release: title + artist credit, artist credit + title, title only |
| `heavy-ta` / `heavy-at` / `heavy-t` | 300 | 60 Recordings each of Bruce Springsteen, Elvis Presley, The Beatles, Bob Dylan and Pink Floyd, whose title is used at most 20 times by that credit |
| `typo` | 400 | `random-ta` with one edit (substitution, deletion, insertion or swap) inside one word of 4+ letters. 319 of them edit a word of 5+ letters, the threshold of Meilisearch's typo tolerance |
| `prefix-ta` / `prefix-t` | 388 / 357 | `random-ta` / `random-t` with the last word cut to about 60% of its letters (search as you type) |
| `accent` | 400 | Recordings whose title or artist has accents, queried with the accents removed |
| `singles` | 50 | The 20 most common title words, then 30 words spread over ranks 21 to 1,200 (latency only, no expected answer) |

**Two recall columns.** *Strict* counts only the expected MBID (what the spike
measured). Many Recordings are identical takes (same title and artist credit;
23% of `random-ta` targets have at least one twin, up to 657, and 62% of
`heavy-*` targets), which makes 100% unreachable, so *any identical* also
accepts a twin of the target. Read the columns against each other.

**Protocol.** One query at a time on one connection, `LIMIT 100`, wall-clock
round trip from the harness container; 150 throwaway warm-up queries; sets
run in the order of the table below. The first set of a run therefore includes
some cache warm-up, for both engines. Sonic
was restarted after every load (see
[below](#sonic-needs-a-restart-after-a-bulk-load)); Meilisearch was queried
about 30 s after its last task finished, and for the full sample after a
container restart that resumed its last slice (see the indexing time).

### The sample is skewed

As in the spike: the sample has 7.3% of the Recordings but 0.5% of the releases
(only 421,708 Recordings are on a track), and it is heavy on a few artists and
on classical music. It is a good stress test for ranking and a poor picture of
the average Recording.

## 1. Results on the sample (2.95 M Recordings)

### Side by side **[measured]**

recall@1 / @10 / @100 (strict), then "any identical" @10 in brackets; latency
p50 / p95 / p99 in ms. Sonic: 4 GiB container. Meilisearch: 6 GiB container
(its 10.9 GB file does not fit the page cache), and the same sets with a 9 GiB
container, where the index stayed in RAM.

| Set | Sonic recall | Sonic latency | Meilisearch recall | Meilisearch latency (6 GiB / 9 GiB) |
| --- | --- | --- | --- | --- |
| random, title + artist | 64.8 / 84.8 / 95.2 (95.8) | 75 / 815 / 1,324 | 81.0 / 95.8 / 99.8 (97.8) | 26 / 97 / 158 , 6.5 / 21.6 / 64.6 |
| random, artist + title | 64.5 / 84.8 / 95.2 (95.5) | 35 / 669 / 1,071 | 74.8 / 95.0 / 99.5 (97.0) | 8.5 / 94 / 152 |
| random, title only | 28.8 / 49.8 / 73.2 (58.2) | 38 / 622 / 935 | 71.5 / 90.8 / 99.5 (93.2) | 5.3 / 21 / 76 , 5.1 / 18.9 / 25.4 |
| heavy artists, title + artist | 26.7 / 53.0 / 87.7 (82.7) | 32 / 257 / 473 | 53.7 / 92.7 / 99.3 (95.7) | 6.4 / 62 / 84 , 6.0 / 15.3 / 155 |
| heavy artists, artist + title | 26.7 / 53.0 / 87.0 (81.7) | 24 / 196 / 452 | 52.0 / 91.0 / 99.3 (95.0) | 6.9 / 21 / 119 |
| heavy artists, title only | 23.3 / 40.0 / 62.3 (59.7) | 29 / 343 / 498 | 51.3 / 82.3 / 99.0 (88.3) | 4.8 / 10.3 / 12.5 |
| one typo (any word of 4+ letters) | 58.0 / 79.2 / 88.8 (87.8) | 32 / 660 / 926 | 71.5 / 89.0 / 93.2 (90.5) | 5.7 / 20 / 32 |
| one typo, word of 5+ letters | 59.2 / 79.3 / 88.4 (87.1) | 37 / 686 / 926 | 77.7 / 94.7 / 98.4 (95.6) | 6.4 / 21 / 33 |
| prefix, title + artist | 59.0 / 78.4 / 88.9 (88.1) | 44 / 678 / 1,055 | 80.4 / 95.6 / 99.7 (97.7) | 9.2 / 44 / 271 |
| prefix, title only | 17.1 / 33.1 / 52.7 (35.3) | 39 / 626 / 976 | 62.2 / 84.0 / 95.8 (86.6) | 7.5 / 49 / 210 |
| accent-free spelling | 77.8 / 96.0 / 99.5 (98.2) | 113 / 737 / 1,041 | 85.0 / 97.0 / 100.0 (97.8) | 15 / 71 / 122 |
| single common words (50) | n/a | 5.7 / 61 / 74 | n/a | 7.6 / 103 / 112 , 4.7 / 10.5 / 12.8 |

Notes on the rows:

- **Empty answers.** Sonic returned nothing for 0 to 0.8% of the queries.
  Meilisearch returned nothing for 0% of the normal sets, 1.1% of `prefix-t`
  and 3.2% of `typo`, all of them typos in words of 4 letters (below its
  5-letter threshold): 11% of those queries are empty, against 1.3% for words
  of 5+ letters.
- **Identical takes.** The gap between the two recall columns is the identical
  takes. Within the strict column Meilisearch is ahead everywhere; in the
  "any identical" column the ahead-ness shrinks on `random-ta` (95.8 vs 97.8)
  but stays large on title-only and prefix sets.
- **Cross-check with the spike.** The spike measured Sonic with the same
  configuration on random title + artist queries: 65.5 / 87.0 / 97.0 and p95
  772 ms. This harness gives 64.8 / 84.8 / 95.2 and p95 815 ms, so the harness
  reproduces the spike within the noise of a different draw of 400
  Recordings. The spike's heavy-artist figure for Sonic (77.3% at 10) is well
  above the 53.0% here; the difference is the draw (62% of this draw's targets
  have identical twins, which caps the strict column) and the "any identical"
  column (82.7%) is the comparable one. **Do not compare the spike's
  Postgres heavy-artist row with this table's rows directly.**
- **Cold start.** The 6 GiB Meilisearch run was the first query run on the
  finished index, so `random-ta` (first set) includes page-cache warm-up: p50
  26 ms against 6.5 ms when repeated at 9 GiB with the cache warm. Sonic's first
  set (`random-ta`, p50 75 ms against 35 ms for the second set) shows the same
  effect.

### Postgres full-text search, from the spike **[source: spike]**

Not re-run. The spike loaded the same 2,948,134 documents as a single
`tsvector` (`mb_simple`, accents folded) with a GIN index (loaded in 112 s;
table 1.8 GB and index 200 MB) and ran its own 700 queries with `plainto_tsquery`
(AND of all words) ordered by `ts_rank_cd`, `LIMIT 100`
(`music-catalog-spike.md`, section 7):

| Query set and text | recall@1 | recall@10 | recall@100 | latency p50 / p95 / p99 |
| --- | --- | --- | --- | --- |
| random, title + artist | 77.2% | 91.2% | 98.8% | 3.7 / 29 / 88 ms |
| random, artist + title | 77.2% | 91.2% | 98.8% | 2.7 / 23 / 32 ms |
| random, title only | 43.8% | 66.8% | 86.5% | 10 / 275 / 2,493 ms (max 7.0 s) |
| heavy-artist, title + artist | 63.0% | 89.3% | 99.3% | 10 / 55 / 120 ms |
| heavy-artist, artist + title | 63.0% | 89.3% | 99.3% | 6.5 / 28 / 49 ms |
| heavy-artist, title only | 59.0% | 80.0% | 94.7% | 4.9 / 95 / 381 ms (max 16.0 s) |

The spike calls this an **idealized** comparison (each query is built from the
target, so an AND always contains it; a misspelled query returns nothing; no
prefix matching). Whether `pg_trgm` or `:*` prefix queries make Postgres
competitive on typos and search-as-you-type, and at what latency, is exactly
what the ticket wanted to know and was **not measured** here **[unverified]**.
The primary sources for what the variants would be: prefix matching with `:*`
in a `tsquery` and the warning that ranking "can be expensive since it
requires consulting the `tsvector` of each matching document"
([text search controls](https://www.postgresql.org/docs/17/textsearch-controls.html)
**[source]**), and `pg_trgm` for "misspelled input words that will not be
matched directly by the full text search mechanism"
([pg_trgm](https://www.postgresql.org/docs/17/pgtrgm.html) **[source]**).

### Concurrency **[measured]**

N clients, each with its own connection, cycling through `random-ta` for 30 s.

| Clients | Sonic queries/s, p50 / p95 / p99 ms | Meilisearch (9 GiB) queries/s, p50 / p95 / p99 ms |
| --- | --- | --- |
| 1 | 7, 35 / 677 / 1,045 | 127, 6.0 / 19.5 / 29 |
| 4 | 17, 53 / 962 / 1,444 | 459, 6.7 / 21.8 / 32 |
| 16 | 18, 285 / 3,432 / 5,858 | 797, 15.9 / 48.1 / 68 |

Sonic stops scaling at about 18 queries per second on this 16-thread machine
(the ceiling looks CPU-bound, cause not isolated **[unverified]**); its peak
memory under 16 clients was 3.2 GiB (page cache included).

### Sonic needs a restart after a bulk load

Two findings that change how Sonic has to be operated with the spike's tuned
RocksDB settings, both **[measured]**:

1. **Unflushed memtables make reads about ten times slower.** With the 256 MiB
   write buffers, the data of a bulk load stays in memtables and the log until
   they fill. The first run (stage 1, 738,352 documents) measured
   `random-ta` at p50 222 / p95 493 ms and the `kv` directory at 259 MB; after
   `docker restart` (RocksDB flushes on start) the same queries gave p50 13.4 /
   p95 320 ms and the directory was 160 MB. Recall was identical. The benchmark
   therefore restarts Sonic after every load. Practical rule (inferred from
   this, not measured separately): load with the bulk settings, then restart
   before serving. Whether Sonic with default RocksDB settings avoids the
   penalty for the writes of the outbox while serving was not isolated
   **[unverified]**.
2. **Re-indexing a Recording moves it to the front among equal scores.** While
   I was developing the update experiment, a first version of it overwrote the
   400 `random-ta` targets, and a restore step re-pushed them. Their recall@1
   then went from 64.8% to 94.0% and recall@10 from 84.8% to 97.8% with no
   change in the query. This is
   the tie-break the spike documented ("most recently pushed document first"),
   seen at full strength: among the many Recordings with the same score,
   **which one comes first depends on when it was last written**, not on
   anything a user would call relevance. Those results were discarded: every
   recall figure in this document comes from runs made before the restore.

## 2. Cost on the sample: disk, RAM, time to index

### Disk **[measured]**

| | Sonic (tuned) | Meilisearch |
| --- | --- | --- |
| Index after the 4th slice, settled | `kv` 606.8 MB + `fst` 1.3 MB = **0.61 GB** (206 B per Recording) | file **10.89 GB**; of which used by data 5.77 GB; original documents 2.39 GB |
| Per Recording | 206 B | 3.7 KB on disk, 2.0 KB used |
| After slice 1 (738,352 docs) | 160 MB (settled) | 2.43 GB file, 1.47 GB used |
| Raw input | 1.76 GB CSV (same for both) | |

Meilisearch's LMDB file never gives back freed pages (**[source]**
[storage](https://www.meilisearch.com/docs/learn/engine/storage): "disk space
usage remains the same" after deleting documents), and it is 1.9x what the data
uses in this run, which was built from four incremental loads (one of them
interrupted and resumed, see below). A single bulk load of the whole sample
would probably be smaller, but the first slice alone (a fresh index) was already
3.3 KB per Recording on disk, so the order of magnitude holds.

### RAM while serving **[measured]**

| | Sonic | Meilisearch |
| --- | --- | --- |
| Process memory, idle after restart | 154 to 170 MB (anonymous) | 150 to 350 MB |
| Process memory, after loading / indexing | 0.5 to 0.8 GB (bulk RocksDB settings) | 0.65 to 1.1 GB (with `MAX_INDEXING_MEMORY=3GiB`) |
| Page cache that latency depends on | 0.1 to 0.3 GB | up to the data size, 5.8 GB: with 6 GiB the `random-ta` p95 was 97 ms, with 9 GiB and a warm cache 21.6 ms |
| Peak under 16 clients | 3.2 GiB (cgroup peak, cache included) | 0.65 GiB |

Meilisearch's documentation says the optimum is "the full dataset fits in
RAM" and that a RAM-to-disk ratio around 1/3 "does not materially impact
performance" (**[source]** [storage](https://www.meilisearch.com/docs/learn/engine/storage)).
The 6 GiB run here had a ratio of 0.55 to the file and 1.0 to the data, and
still showed a 4.5x p95 difference against the 9 GiB run; part of it is the
cold start described above, so I do not claim the two are the same effect
**[unverified]**.

### Time to index the sample **[measured]**

| | Sonic | Meilisearch |
| --- | --- | --- |
| Slice 1 / 2 / 3 / 4 (738 k documents each) | 51 / 58 / 55 / 57 s (13,000 to 14,400 documents/s, 8 connections) | 52 / 83 / 186 s for slices 1 to 3; slice 4 about 508 s, see below |
| Whole sample | **221 s** of pushes (plus 167 s to build the documents in SQL, common to both) | about **14 min** |

Meilisearch's slice 4 was interrupted (the container was stopped while it
indexed) and resumed: the first 100 k-document batch took 251 s before the
stop and the other seven tasks took 257 s after the resume, so 508 s is an
upper-bound reading, not a clean measurement. The trend is what matters:
adding the same 738 k documents took 52, 83, 186 and about 500 s as the index
grew, so Meilisearch's cost per added document grows with index size in this
setup (incremental loads in 100 k-document tasks), unlike Sonic's (flat here).

## 3. How each engine moves as the index grows, inside the sample

Same queries after each slice, `random-ta` (title + artist), strict recall@10,
p95 latency. **[measured]**

| Slice (documents) | Sonic recall@10 / p50 / p95 ms | Meilisearch recall@10 / p50 / p95 ms (6 GiB) |
| --- | --- | --- |
| 25% (738 k) | 93.0 / 13 / 320 | 96.2 / 4.1 / 13.5 |
| 50% (1.47 M) | 90.0 / 18 / 360 | 96.0 / 5.7 / 25.9 |
| 75% (2.21 M) | 88.2 / 37 / 954 | 95.8 / 11.7 / 83.5 |
| 100% (2.95 M) | 84.8 / 75 / 815 | 95.8 / 25.5 / 96.5 |

Sonic loses recall as the index grows (consistent with the candidate cap
described in the spike [source: spike]: more Recordings compete for the same
words), Meilisearch keeps it; both get slower, Meilisearch from a much lower
start. The Meilisearch jump between 50%
and 75% coincides with the index growing past the 6 GiB container limit
(4.8 GB of file at 50%, 7.8 GB at 75%), so part of it is page cache rather than
the engine **[unverified]**.

## 4. Extrapolation to the full dataset (40.4 M Recordings plus Lyrics)

All of this is **[extrapolated]** by calculation from the sample
measurements, with no full-scale run. The factor is 40,393,216 / 2,948,134 =
**13.7** Recordings. Treat every figure as an order of magnitude; the sample is
skewed (see above), and a real run at scale is the only way to confirm any of
it. The harness can do that run (README in the harness folder).

| Quantity | Sonic | Meilisearch | Basis |
| --- | --- | --- | --- |
| Metadata index on disk | **8.3 GB** (206 B x 40.4 M) | **149 GB** file (3.7 KB x 40.4 M), 79 GB of data (2.0 KB x 40.4 M) | linear in documents. Sonic agrees with the spike's 8 to 13 GB [source: spike] |
| Metadata index, blue-green reimport | about 2x during the swap | about 2x: **about 300 GB** | both keep the old copy while building the new one |
| Lyrics index (4 to 14 M songs) | 2 to 7 GB | 43 to 150 GB | per-song figures of the [Lyrics section](#5-lyrics-index-synthetic), 80 to 280 times the 50,000 songs measured. A real lyric longer than the synthetic 1 KB scales both up |
| Time to index, bulk | 52 min at the measured 13,000 documents/s; 1 to 3 h with the tuned settings at 12 M+ objects [source: spike] | at least 3.2 h at the average 3,500 documents/s of the sample; the per-slice times grew with index size (52, 83, 186, about 500 s), so this is a **lower bound** | linear, and the trend noted above |
| Latency p95, title + artist | **about 4.7 s** (815 ms x 13.7^0.67, exponent from 25% to 100%); the spike saw 1.5 s to 5.9 s at 16.1 M stress objects [source: spike] | between **about 52 ms** (21.6 ms x 13.7^0.34, only if the whole index stays in page cache, which needs about 80 GB of RAM) and **about 4 s** (96.5 ms x 13.7^1.42, the trend of the RAM-limited run) | power-law fits over the four slices. The true value depends on how much of the index fits in RAM, which is the main uncertainty |
| Throughput | below the 18 queries/s measured on 2.95 M | above 800 queries/s at 2.95 M; at scale depends on cache | |
| Postgres full-text, for reference [source: spike] | | | table 1.8 GB + index 0.2 GB x 13.7 = about **27 GB**; the spike's "Lyrics text in Postgres" (15 to 50 GB) is separate |

## 5. Lyrics index (synthetic)

**[measured]** on synthetic text, because the LRCLIB dump (47.6 GB) was out of
scope of this run and real lyrics must not be redistributed. The harness writes
50,000 songs of about 1 KB (27 lines of 7 words, a four-line chorus repeated
three times), words drawn from the real frequency distribution of the sample's
titles (Zipf-like, which is what index size depends on), each attached to a
real MBID. The query set `lyrics-line` has 300 queries of five consecutive
words of one line; the expected answer is that song. What this does not
reproduce is real lyrics' repetition, rhyme, vocabulary size and language mix
**[unverified]**.

| | Sonic (bucket `lyrics`) | Meilisearch (index `lyrics`) |
| --- | --- | --- |
| Text | 50,000 songs, 52.7 MB (1,053 B each) | same |
| Index size | +24.4 MB = **488 B per song** | 537 MB = **10.7 KB per song** (10.2x the text) |
| Indexing time | 15 s (one connection) | 19 s |
| recall@1 / @10 / @100 | 50.0 / 65.0 / 82.3% | **100 / 100 / 100%** |
| Latency p50 / p95 / p99 | 2.5 / 20 / 43 ms | 3.5 / 6.9 / 9.2 ms |

The spike measured Sonic at 820 B per synthetic 1.5 KB song (5,850 pushes per
second) [source: spike], consistent with the 488 B per 1 KB here. Sonic's
recall on phrases is low because its multi-word query is an OR ranked by summed
score and ignores word order; the test is easy (50,000 songs, exact words), so
the real gap at millions of songs is probably wider **[unverified]**.
Meilisearch's cost is the size: about ten times the text.

## 6. Operational fit

### Incremental updates from the outbox **[measured]**

Each update sends the whole document again (what the worker would do after
recomputing it), for 200 Recordings one at a time and then 2,000 in a burst.
Originals were written back afterwards.

| | Sonic | Meilisearch |
| --- | --- | --- |
| API | No update command: `FLUSHO` then `PUSH` (between the two the Recording is absent from results) [source: spike] | `POST /indexes/{uid}/documents` (partial update on an existing primary key, [source](https://www.meilisearch.com/docs/reference/api/documents/add-or-update-documents)), `POST .../documents/delete-batch` with ids to delete ([source](https://www.meilisearch.com/docs/reference/api/documents/delete-documents-by-batch)); asynchronous tasks |
| One update: call returns | p50 6.8, p95 93, max 642 ms | p50 26, p95 64, max 1,678 ms (task enqueued) |
| One update: new text found by search | **p50 8.9, p95 97 ms** | p50 387, p95 1,095, max 2,080 ms |
| Burst of 2,000 updates | 20.0 s = 100 documents/s | 38.2 s = 52 documents/s in one task |
| Query latency right after the burst | p95 898 to 954 ms (unchanged) | p50 193, p95 734 ms; p50 13 / p95 111 ms a few minutes later (page cache re-warming, cause not isolated **[unverified]**) |
| Delete | `FLUSHO` | delete-batch by ids |

Both are fast enough for small batches. For a large backlog (for example after
the worker was down), 1 M changed Recordings would take about 5.3 h at
Meilisearch's 52 documents/s and about 2.8 h at Sonic's 100 documents/s
**[extrapolated]**. Sonic's updates come with
the ordering problem described in
[Sonic needs a restart after a bulk load](#sonic-needs-a-restart-after-a-bulk-load):
an updated Recording jumps ahead of its twins.

MusicBrainz MBIDs are valid Meilisearch primary keys: "alphanumeric
characters, hyphens and underscores" (**[source]**
[primary key](https://www.meilisearch.com/docs/learn/getting_started/primary_key)).

### Blue-green reimport (second index built while the first serves) **[measured]**

A client kept running `random-ta` queries against the live index while a second
index was built; queries before the build, during it, and around the swap.

| | Sonic | Meilisearch |
| --- | --- | --- |
| Second index | 738,352 documents (all of slice 1), second collection | 200,000 documents, second index |
| Build time | 60 s | 17 s |
| Query latency before | p50 53 / p95 894 / p99 1,442 ms | p50 6.1 / p95 20.2 / p99 29 ms |
| Query latency during | p50 46 / p95 1,167 / p99 2,187 ms (+30% at p95) | p50 7.3 / p95 27.2 / p99 78 ms (+35% at p95) |
| Swap | **no operation**: the application switches the collection name; dropping the old one (`FLUSHC`) took 26 ms for 738 k documents | `POST /swap-indexes`, atomic, **103 ms** |
| Disk while both exist | about 2x | about 2x |

Meilisearch's swap "exchanges the documents, primary key, settings and task
history" and is atomic, but "enqueued tasks are left unmodified", so writes
still queued for the old name would land on the wrong index; the application
has to stop writing (or drain the queue) before the swap (**[source]**
[swap indexes](https://www.meilisearch.com/docs/reference/api/indexes/swap-indexes)).
The Meilisearch build here was a 200,000-document slice, not the full sample,
to keep the disk use small; the effect on queries of a full-size build is
therefore not measured **[unverified]** (the indexer uses as many threads as
the machine allows: default "half of the available threads"
[source](https://www.meilisearch.com/docs/learn/configuration/instance_options)).

### Licence, deployment and other facts

| | Sonic | Meilisearch | Postgres |
| --- | --- | --- | --- |
| Licence | MPL-2.0 [source](https://github.com/valeriansaliou/sonic) | Community Edition MIT; the Enterprise Edition (sharding only) is BUSL-1.1 [source](https://www.meilisearch.com/docs/resources/self_hosting/enterprise_edition) and [LICENSE](https://github.com/meilisearch/meilisearch/blob/main/LICENSE). The Community Edition may be used in production for free. | PostgreSQL License, "similar to the BSD or MIT licenses" [source](https://www.postgresql.org/about/licence/) |
| Already in the stack | no | no | yes |
| Replication / several instances | not described in its docs [source](https://github.com/valeriansaliou/sonic/blob/v1.10.1/INNER_WORKINGS.md) | Community Edition is single-node; replication and sharding are Cloud or Enterprise [source](https://www.meilisearch.com/docs/resources/self_hosting/enterprise_edition) | standard Postgres |
| Image | distroless, no shell (no in-container health check) [source: spike] | not checked here [unverified] | |
| Client | no maintained npm client (last release January 2023), 60 lines of raw TCP in this harness [source: spike] | HTTP/JSON, used from the harness with the standard library | |
| Result order | by score; ties by last push | by ranking rules; `searchableAttributes` order ranks title above artist [source](https://www.meilisearch.com/docs/learn/relevancy/ranking_rules) | by `ts_rank_cd` |
| Settings change | tokenizer settings need a re-index [source: spike] | "changing settings after indexing triggers a full reindex" [source](https://www.meilisearch.com/docs/learn/indexing/indexing_best_practices) | re-create the tsvector |

notefinder is non-commercial (decided on #55), so the licence is not a
deciding factor for any of the three; the Enterprise Edition of Meilisearch
would only matter for sharding, which one server does not need.

Both engines return MBIDs in their own relevance order, and the catalog keeps
that order when it loads Recordings from Postgres (the maintainer's rule); the
only engine-specific wrinkle is Sonic's tie-break by recency, described above.

## Recommendation and decisions for the maintainer

The maintainer decides; this is what the numbers say.

**Search quality and speed favour Meilisearch by a wide margin at 2.95 M.**
Against tuned Sonic, on the same queries: recall@10 of 95.8% vs 84.8% for title +
artist, 90.8% vs 49.8% for title only, 94.7% vs 79.3% with one typo, 95.6% vs 78.4% for
search as you type; p95 of 22 to 97 ms vs 815 ms; 797 vs 18 queries per
second. The cases the ticket worried about (typos, prefixes, accent-free
spelling) work with default settings and no extra code. Tuned Sonic puts the
right Recording in the top 10 11 points less often for title + artist and 41
points less often for title only, and its cost per query is hundreds of
milliseconds at 2.95 M, so a 40 M catalog would be
seconds (extrapolated from this and from the spike's own 16 M stress result).

**The price of Meilisearch is disk (and a slower index build).** About 3.7 KB
per Recording on disk in this run: **79 to 149 GB** for the 40.4 M Recordings
**[extrapolated]**, against about 8 GB for Sonic and the spike's 8 to 13 GB.
That is before the Lyrics (43 to 150 GB more if they go there too) and before
doubling it while a blue-green reimport holds both copies. The sizing in #65
("about 120 GB steady state") has to be redone with that number, and with
enough RAM for most of the index to stay cached.

**Postgres full-text search, per the spike's calibration, is the third
option and the cheapest to run**: already in the stack, about 27 GB
extrapolated, idealized quality between the other two on multi-word queries.
What it cannot be said to do from these numbers is typos and search-as-you-type
(not measured) and its tail on single-word queries (the spike saw p99 of 2.5
seconds and a 16 s maximum for ranking every match of a common word).

What I would do, in order:

1. **If that disk budget is acceptable, take Meilisearch** for the metadata
   search, with the Lyrics decision below.
2. **If it is not, the next candidate is Postgres full-text search with a
   prefix query and a trigram fallback**, measured with this harness (the
   harness has the query sets; an adapter for Postgres is the missing piece)
   before accepting the Search ticket, because its typo and prefix behaviour is
   the open question.
3. **Do not ship Sonic as tuned** for Recording search.

Open decisions:

- **Lyrics engine.** The spec has Lyrics in a second bucket of the same engine.
  With Meilisearch that is an index of about 10 KB per song (43 to 150 GB
  extrapolated for 4 to 14 M matched Lyrics); with Sonic 0.5 KB per song but
  half the recall on phrase queries on synthetic text. The Lyrics scope could
  use a different engine from the metadata scope; that is a choice for #58 or
  a follow-up, not something these numbers settle. Real lyrics (size,
  vocabulary) may change the sizes.
- **Validate at scale before buying hardware.** Every full-dataset number
  above is extrapolated from a sample that is 7.3% of the Recordings and
  skewed. The disk figure is the most reliable (linear); the latency figures
  are a range of 52 ms to 4 s for Meilisearch and depend on RAM. #58 can
  rerun the harness at full scale.
- **Index build on first import.** Meilisearch's incremental cost grows with
  index size (52 to about 500 s per 738 k documents here). A bulk import of
  the whole dataset in fewer, larger batches may behave differently; it was
  not tested.
- **Meilisearch against Postgres stays open.** The gap between Meilisearch and
  Sonic is large and measured on the same queries. The comparison with Postgres
  mixes this run with the spike's idealized calibration (other queries, no
  typos, no prefixes) and should be treated as open until Postgres is measured
  with this harness.

## Limits of this benchmark

- One machine, one client, other work running; latencies are indicative.
  Query sets of 300 to 400 queries: a recall figure near 90% carries a 95%
  interval of about +-3 points.
- The sample only; scale effects are extrapolated.
- Meilisearch's index came from incremental loads (four slices of 100 k-document
  tasks, one interrupted and resumed); size and time to index would differ for
  a single bulk load.
- Meilisearch ran in containers limited to 6 GiB and 9 GiB; Sonic to 4 GiB.
- Only one Meilisearch configuration (searchable attributes in the order of
  the spec's fields, defaults otherwise) and one Sonic configuration (the
  spike's) were tested. Sonic with larger FST graph caps, which the spike left
  untested, may do better on typos and prefixes **[unverified]**; Meilisearch
  with other attribute orders or ranking rules was not tried.
- Lyrics are synthetic.
- The heavy-artist sets cannot be compared with the spike's (different draw).

## Appendix: reproduction

The harness is in
[`music-catalog-search-benchmark/`](music-catalog-search-benchmark/README.md):
Docker only, Python 3.13 inside a container, nothing installed on the host, all
containers named `nfbench-*`, scratch files outside the repo. The steps for this
run:

```sh
cd docs/research/music-catalog-search-benchmark
export BENCH_DIR=$HOME/.cache/nf-bench
./run.sh build-tools && ./run.sh download-sample
./run.sh mb-restore && ./run.sh prepare            # documents, query sets, exports
./run.sh sonic-up  && ./run.sh matrix sonic        # 4 slices, then the full sets
./run.sh meili-up  && ./run.sh matrix meili
./run.sh bench report --results sonic-s4           # any results file
./run.sh bench throughput --engine meili --clients 16
./run.sh bench ops-updates --engine meili
./run.sh bench ops-bluegreen --engine meili --docs 200000
./run.sh bench lyrics-gen --count 50000 && ./run.sh bench lyrics-load --engine meili
./run.sh clean
```
