# Music catalog spike: MusicBrainz, mbslave, LRCLIB and Sonic

> Historical note: every measurement in this document was taken on the
> official MusicBrainz sample dump, dropped in #85 in favor of `full` and
> `tiny`. The numbers are kept as history.

Findings for [#56](https://github.com/Theryston/new-notefinder/issues/56), the
spike behind the Music catalog spec
([#55](https://github.com/Theryston/new-notefinder/issues/55)). Work done on
2026-09-30. Vocabulary (Music catalog, Recording, Lyrics) is the one defined in
`CONTEXT.md`.

## How to read this document

Every claim carries one of these labels, so a fact can be told from a guess:

- **[source]**: read in a primary source (linked next to it).
- **[measured]**: measured by running the thing (how, in
  [Method and environment](#method-and-environment)).
- **[extrapolated]**: computed from a measurement or a source number, with the
  formula stated. Treat as an estimate.
- **[unverified]**: could not be checked. Not a claim.

Nothing in the repo was changed by this spike except this document. All scratch
work (containers, dumps, scripts) lived outside the repo. The acceptance
criteria of #56 map to sections 1 to 7, and the last section is the impact on
the spec.

## Summary

| Risk in #55 | Verdict |
| --- | --- |
| 1. mbslave init with the sample dump | **Works, but not through plain `mbslave init`.** `init --empty` then `import mbdump-sample.tar.xz`: 236 of 237 tables, 3 min 14 s, 2,948,134 Recordings. |
| 2. Custom dump base URL (e2e fake server) | **Yes**: `auto-import --mirror <url>` or `import <url>...`; `sync` takes `MBSLAVE_MUSICBRAINZ_BASE_URL`. Plain `init` cannot. Verified against a fake HTTP server. |
| 3. Archives and SQL scripts | `mbdump.tar.bz2` + `mbdump-derived.tar.bz2` (tags and genres live in derived); edit history not needed. Eight mbslave SQL scripts build the 375-table schema in 4.4 s through `psql`. |
| 4. Disk, RAM, indexing time | Sample: 3.9 GB database, 0.6 GB Sonic, about 12 min. Full (extrapolated): about 64 GB database, 8 to 13 GB Sonic, about 120 GB steady, first import 4 to 8 h here. |
| 5. LRCLIB dump | **One 47.6 GB gzip of a 260 GB SQLite file**, published by hand at irregular intervals (16 days to about 4 months between the dumps I could date), no checksum, no incremental form, undocumented listing endpoint. |
| 6. MetaBrainz token | Free for non-commercial use only; companies choose a paid or stealth tier. Packets and the derived dump are CC BY-NC-SA. mbslave reads `MBSLAVE_MUSICBRAINZ_TOKEN` (or `_FILE`). Replication stops once a year until mbslave is upgraded. |
| 7. Sonic | Results are relevance-ordered (confirmed) and the limits are documented, but **the defaults make search unusable** at this size (33.5% of queries empty, recall@10 14%) and even tuned it needs a very large candidate cap that costs seconds at the tail on 16 M objects. |

What to read first:

1. **Search with Sonic is at risk** (section 7 and the impact list): two default settings must change before indexing, `retain_word_objects` needs to be around 1,000,000 or more, and latency then reaches seconds at the tail on 16 M objects. A Postgres full-text baseline on the same data is 1 to 2 orders of magnitude faster on multi-term queries.
2. **Licensing needs a maintainer decision**: sync and genres use NonCommercial-ShareAlike data and a token whose free tier is non-commercial.
3. **The LRCLIB import is much bigger than the spec assumes**, and `sample` mode cannot take a slice of it.
4. **`mbslave init` cannot be the bootstrap as written**: use `init --empty` and `import`, from an image that has Python, mbslave and `psql`, and note the yearly manual schema upgrade.
5. Everything else in the spec held up.


Decisions of the spec that are affected are collected in
[Impact on the spec (#55)](#impact-on-the-spec-55).

## Decisions taken after this spike

Added to this PR after review. The maintainer took the decisions
below in [this comment on #55](https://github.com/Theryston/new-notefinder/issues/55#issuecomment-5915812512)
and in the "Decided after the spike (#56)" part of #55's Implementation
Decisions, which override the older text of the spec. The findings in the rest
of this document are left as written, as the record of what the spike saw and
proposed; where a decision differs from a proposal in
[Impact on the spec (#55)](#impact-on-the-spec-55), it says so.

- **Search engine: pending a benchmark.** Tuned Sonic vs Meilisearch vs
  Postgres full-text search on the MusicBrainz sample; [#58](https://github.com/Theryston/new-notefinder/issues/58)
  (Search) is blocked until the maintainer picks from the numbers in
  [#68](https://github.com/Theryston/new-notefinder/issues/68). Whatever the
  engine, results keep its relevance order when loaded from Postgres.
  **Differs from the proposals** (impact item 1): the spike suggested keeping
  tuned Sonic and benchmarking it at 40 M documents, and measured Postgres
  full-text search only as a calibration point; the decision is a three-way
  benchmark on the 2.95 M sample instead, and Meilisearch was not measured by
  the spike.
- **Licence: notefinder is non-commercial.** It uses the free MetaBrainz token;
  attribution for genres and tags (CC BY-NC-SA 3.0) is owed where they are
  shown, which is web work and out of scope for the Music catalog. Carried by
  [#62](https://github.com/Theryston/new-notefinder/issues/62) (replication,
  note in the app's `CLAUDE.md`) and [#65](https://github.com/Theryston/new-notefinder/issues/65)
  (deploy docs). Answers impact item 2; the "core dump only, no genres, no
  sync" fallback is not needed.
- **Restore: the mbslave container owns it**, with `init --empty` + `import`,
  mbslave pinned to git tag `v31.0.1`, recording `restored`; the worker waits
  for `restored`, then installs triggers, imports Lyrics and indexes. Carried by
  [#60](https://github.com/Theryston/new-notefinder/issues/60). **Matches** the
  proposal in impact item 6 (the worker waits on a recorded phase rather than
  on polling `replication_control`, as that item suggested).
- **Yearly schema change: CI bump PR plus an automatic blue-green reimport**,
  new ticket [#69](https://github.com/Theryston/new-notefinder/issues/69). A
  scheduled CI job opens a PR bumping the pinned mbslave version and runs the
  e2e suite on it; the maintainer merges it and runs `docker compose pull &&
  docker compose up -d`; the service then restores and indexes a parallel copy
  while the current one serves, reuses Lyrics (match rerun), and swaps when the
  new copy is ready. `CATALOG_NOT_READY` stays first-import-only; #62 only has
  to make a stall visible in `status` and the logs. **Differs from the
  proposal** (impact item 5): the spike proposed the mbslave image applying
  `updates/schema-change/<n>.all.sql` in place; the decision is a full
  reimport (about twice the disk during the swap), with the bump PR and the
  reimport automated and the merge plus `pull && up -d` as the single human
  step per year.
- **LRCLIB in `sample`: a fake dump generated locally.** A deterministic,
  seeded generator writes an SQLite file in the real LRCLIB schema from a few
  thousand imported Recordings, with near-miss cases that must not match
  (length just outside ±2 s, "(Live)" or remix titles, a different album on a
  tie); the same generator feeds the e2e fixture, the import and match code is
  the same for fake and real dumps, and nothing is downloaded from LRCLIB. The
  importer checks the dump's schema and fails loudly on a mismatch. Carried by
  [#63](https://github.com/Theryston/new-notefinder/issues/63). **Differs from
  the proposal** (impact item 4): the spike proposed publishing a small slice
  of the real LRCLIB data in the real schema; the decision generates synthetic
  data instead, so no real lyrics are published or downloaded in `sample`.
- **LRCLIB in `full`: streamed download and gunzip, refreshed at most every N
  days** (env, default 30), about 260 GB of temporary disk per import, deleted
  afterwards. The worker still checks the (undocumented) listing, as section 5
  describes, but imports a newer dump at most once per interval. Carried by
  [#63](https://github.com/Theryston/new-notefinder/issues/63) and
  [#64](https://github.com/Theryston/new-notefinder/issues/64). Answers impact
  item 3. The two-pass import proposed there (match on `tracks` first, copy
  lyrics text only for matched Recordings, to avoid about 110 GB of text) is
  not mentioned in the comment or in the decision block of #63, so it remains a
  proposal for that ticket to settle.
- **Sizing for the docs and the compose:** about 64 GB Postgres and 8 to 13 GB
  of search index in `full` (about 120 GB steady state), plus about 260 GB
  temporary per LRCLIB import, about twice the steady state during a
  blue-green reimport, and at least 8 GB of RAM; `sample` is about 3.9 GB
  Postgres and 0.6 GB of index, about 12 minutes. These are this document's
  numbers, taken as the plan. Carried by [#65](https://github.com/Theryston/new-notefinder/issues/65)
  (now also blocked by #69). The "search index" size is Sonic's until #68
  decides the engine.

Impact items 7 to 11 and 13 to 20 (explicit-URL `import` instead of
`auto-import`, `limit`/`offset` bounds, no Sonic health check, extra env
variables, the `sample` dataset not being small, and the things that hold) are
not addressed by the decisions; they stand as written, and the search-specific
ones (8, 9 and the Sonic settings of section 7) depend on the engine chosen in
#68. Item 12 (mbslave built from git, pinned) is covered by the restore
decision above.

## Method and environment

Everything was run on one developer laptop (Linux, 16 threads, 15 GiB RAM of
which about 5 GiB were free because of other applications, NVMe SSD), with
Docker 29.7, using throwaway containers on a private Docker network:

| Piece | What was run |
| --- | --- |
| Postgres | `postgres:17-alpine` (17.11), the image the repo's `docker-compose.yml` uses. Non-default settings: `shared_buffers=1GB`, `maintenance_work_mem=1GB`, `max_wal_size=8GB`, `checkpoint_timeout=30min`. |
| mbslave | Tag [`v31.0.1`](https://github.com/acoustid/mbslave/tree/v31.0.1) (2026-09-28) installed from git into `python:3.13-slim` plus `postgresql-client` (Dockerfile in the [appendix](#appendix-reproduction)). |
| Sonic | `valeriansaliou/sonic:v1.10.1` from [Docker Hub](https://hub.docker.com/r/valeriansaliou/sonic), configured only with `SONIC_*` environment variables. |
| Sonic client | A 60-line raw TCP client written for the spike (the protocol is line based, see [PROTOCOL.md](https://github.com/valeriansaliou/sonic/blob/v1.10.1/PROTOCOL.md)). |
| Data | The MusicBrainz sample dump of 2026-09-01 (`mbdump-sample.tar.xz`), restored. The full MusicBrainz dump of 2026-09-30 was **streamed and measured table by table, never restored** (section 4). LRCLIB: the dump listing, the first bytes of the dump, and its public API. |

Numbers marked **[measured]** come from this laptop while other work was
running, so absolute times are indicative, not benchmarks. Download speed from
`data.metabrainz.org` to this machine was about 1.0 to 1.5 MB/s, which is a
property of this network, not of the service. Sizes use decimal units (1 GB =
10^9 bytes) except where a source is quoted; the directory listings of
`data.metabrainz.org` use binary units ("7G" is 7.06 GiB).


## 1. Does mbslave init accept the official sample dump?

**Yes, but not through plain `mbslave init`.** Use `mbslave init --empty`
(schema only) followed by `mbslave import <sample archive>`.

### What the sample dump is

- Published monthly next to the full export:
  [`/pub/musicbrainz/data/sample/`](https://data.metabrainz.org/pub/musicbrainz/data/sample/)
  has one directory per run (`20260801-000001`, `20260901-000002`) and a
  `LATEST` file. The MusicBrainz server docs say "a database sample,
  published once a month" and that it can be found "using `sample` instead of
  `fullexport` in the URL"
  ([INSTALL.md](https://github.com/metabrainz/musicbrainz-server/blob/master/INSTALL.md)).
  **[source]**
- One file per run: `mbdump-sample.tar.xz` (358,578,548 bytes = 342 MB) plus a
  detached `.asc` signature. It is `.tar.xz`, while the full export is
  `.tar.bz2`. **[source]** (directory listing)
- Streaming the archive **[measured]**: 237 `mbdump/<table>` members, plus
  `TIMESTAMP` (`2026-09-01 00:00:02+00`), `REPLICATION_SEQUENCE` (`188657`),
  `SCHEMA_SEQUENCE` (`31`), `COPYING` and `README`; 1.71 GB uncompressed.
  Core and derived tables (for example `recording_tag`) are in the same
  archive.
- It is **not small in Recordings**, only in everything else. Restored, it has
  2,948,134 Recordings, 259,983 artists, 28,869 releases and 577,748 tracks.
  The full database has 40,393,172 Recordings, 2,999,708 artists, 5,814,400
  releases and 58,166,723 tracks
  ([statistics](https://musicbrainz.org/statistics), 2026-09-30). So the sample
  keeps 7.3% of the Recordings but 0.5% of the releases: only 421,708 of its
  Recordings are on a track. It is also skewed (65,683 Recordings by Bruce
  Springsteen, 31,346 by Elvis Presley, 26,764 by The Beatles), which makes it a
  good stress test for search but a poor picture of the average Recording.
  **[measured]**

### Why plain `mbslave init` cannot load it

`mbslave init` without `--empty` ends by running `mbslave auto-import` with no
arguments ([`replication.py` L773-774](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L773-L774)).
`auto-import` defaults to the mirror
`http://ftp.musicbrainz.org/pub/musicbrainz/data/fullexport/`
([L891](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L891))
and downloads a fixed list of five `*.tar.bz2` names
([L385-391](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L385-L391)),
none of which is `mbdump-sample.tar.xz`. **[measured]**: `auto-import --mirror
.../sample/` reads `LATEST` (`20260901-000002`) and then fails with `HTTP Error
404: Not Found` on `mbdump.tar.bz2`.

### What works **[measured]**

```sh
mbslave init --create-user --create-database --empty   # 12 s, schema + PKs + indexes + functions
mbslave import /dumps/mbdump-sample.tar.xz              # or an https:// URL, 3 min 14 s
```

- `init --empty` created 7 schemas (`musicbrainz`, `cover_art_archive`,
  `event_art_archive`, `statistics`, `documentation`, `wikidocs`, `dbmirror2`),
  375 tables and 10 views in `musicbrainz` and 899 indexes there. No errors on Postgres
  17.11.
- `import` reads the archive as a stream (`tarfile` in `r|*` mode, so xz and
  bz2 are both detected, [L298](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L298)),
  loads each `mbdump/<table>` with `COPY`, and finished in 3 min 14 s (another
  job was streaming the full dump at the same time). 236 of 237 tables loaded;
  row counts equal the archive's line counts (for example 2,948,134
  `recording` rows).
- The one skipped table is `cover_art`: the sample names it without a schema
  prefix, mbslave looks for `musicbrainz.cover_art`, and the table lives in
  `cover_art_archive`. **In `sample` mode `cover_art_archive.cover_art` stays
  empty**, so nothing in the sample tells which releases have cover art.
- After the sample import `musicbrainz.replication_control` is **empty**
  (the sample has no such file). `mbslave sync` reads one row from it
  ([L620-621](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L620-L621)),
  so sync cannot start on a sample database. That agrees with the spec keeping
  replication off in `sample` mode (story 53). The full dump does ship the row
  (`mbdump/replication_control`, 1 line, see
  [section 3](#3-which-dump-archives-and-which-sql-scripts)).

### Gotchas found on the way **[measured]** unless noted

- **PyPI is stale.** [`mbslave` on PyPI](https://pypi.org/project/mbslave/) is
  28.0.0 (2023-11-10). MusicBrainz is on schema sequence 31
  ([musicbrainz-docker README](https://github.com/metabrainz/musicbrainz-docker#components-version),
  the sample and replication packets say 31). Install from the git tag, not from
  PyPI. Also, at tag `v31.0.1` `pyproject.toml` still says `version =
  "28.0.0"`, so `pip list` shows 28.0.0 for the schema-31 code: pin by tag or
  commit, never gate on the reported version. No official Docker image exists
  (Docker Hub `acoustid/mbslave` and the GitHub Packages API both answered "not found" **[checked]**).
- **`init` is not idempotent.** Running it again on an initialised database
  exits 1 at `CreateSearchConfiguration.sql` (`mb_simple` already exists). The
  bootstrap has to detect "already initialised" before calling it.
  `import` is friendlier: it skips any table that already has rows
  ([L324](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L324))
  and a half-downloaded archive resumes with an HTTP `Range` request
  ([L257-260](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L257-L260)).
  Each table is loaded in one transaction, so a crash leaves whole tables, not
  partial ones.
- **The README's database-name variable is wrong.** The README says
  `MBSLAVE_DB_NAME`; the code reads `MBSLAVE_DB_DB`
  ([L122](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L122)).
  Setting `MBSLAVE_DB_NAME=zzz` is silently ignored (it connected to
  `musicbrainz`). Every secret variable also accepts a `*_FILE` variant
  ([L47-55](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L47-L55)).
- **`init --empty` builds primary keys and indexes before the data goes in**
  (the PK/index scripts are after the `auto-import` step in `init`, and
  `--empty` skips only that step). On the sample that was fine. Whether
  loading 50 GB into already-indexed tables is much slower than "load, then
  index" (which is what MusicBrainz's own `InitDb.pl` does) was **not measured
  for the full dump [unverified]**. The alternative is to run `init`'s SQL
  scripts one by one with `mbslave psql -f`, importing between the "tables" and
  the "primary keys" groups (script list in section 3).
- Postgres 17 works. MusicBrainz's own compose file uses Postgres 18 and
  mbslave's dev image uses 16 ([musicbrainz-docker](https://github.com/metabrainz/musicbrainz-docker/blob/master/build/postgres/Dockerfile),
  [`Dockerfile.postgres`](https://github.com/acoustid/mbslave/blob/v31.0.1/Dockerfile.postgres));
  16 and 18 were not tried here **[unverified]**.
- `Extensions.sql` needs a superuser and the `cube`, `earthdistance` and
  `unaccent` contrib extensions, and `CreateCollations.sql` needs ICU support.
  Both are present in `postgres:17-alpine` **[measured]**. So the bootstrap
  needs the admin credentials (`MBSLAVE_DB_ADMIN_USER`,
  `MBSLAVE_DB_ADMIN_PASSWORD`) in addition to the application's own.

## 2. Can mbslave download dumps from a custom base URL?

**Yes**, for everything except the built-in step of plain `init`.

| Command | Custom URL | How |
| --- | --- | --- |
| `mbslave init` (without `--empty`) | No | Hard-coded call to `auto-import` with its default mirror ([L774](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L774)). |
| `mbslave auto-import` | Yes | `--mirror <url>`. Reads `<url>/LATEST` (a text file with the directory name, e.g. `20260930-002222`), then downloads `<url>/<latest>/` + `mbdump.tar.bz2`, `mbdump-derived.tar.bz2`, `mbdump-cover-art-archive.tar.bz2`, `mbdump-event-art-archive.tar.bz2`, `mbdump-stats.tar.bz2`. All five must exist (a 404 aborts). `--work-dir` chooses where the archives are kept. |
| `mbslave import` | Yes | `mbslave import <url-or-path>...`: any number of `http(s)://` URLs (downloaded into `--work-dir` under their file name) or local paths ([L349-365](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L349-L365)). This is the only way to pick exactly which archives to load. |
| `mbslave sync` (replication) | Yes | `MBSLAVE_MUSICBRAINZ_BASE_URL` (or `[musicbrainz] base_url`), default `https://metabrainz.org/api/musicbrainz/`. It requests `<base>/replication-<N>-v2.tar.bz2?token=<token>` ([L579-583](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L579-L583)). |

**[measured]** with a fake mirror: `python -m http.server` serving a
`LATEST` file and the five archives, each a few KB, built from 12 tables of
the restored sample (5 Recordings and what they reference, plus the whole
`genre` table). Against a fresh database:

```sh
mbslave init --create-user --create-database --empty         # 37 s under load, 12 s alone
mbslave auto-import --mirror http://fake-mirror:8000/        # 2 s
```

It loaded 5 `recording`, 5 `track`, 79 `recording_tag` and 2,195 `genre`
rows. Pointing `sync` at the same server with a made-up 40-character token
produced the request `GET /replication-2-v2.tar.bz2?token=0123...` (mbslave
redacts the token in its own log line as `token=***`) and, on 404, `Not found,
stopping` (exit 0). With `--keep-running` it instead sleeps 10 minutes and
polls again ([L637-643](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L637-L643)).

What a fixture archive needs to look like: a tar (any compression `tarfile`
can stream) whose members are named `mbdump/<table>` and hold the table in
PostgreSQL `COPY ... TO STDOUT` text format (tab separated, `\N` for null,
columns in table order). `TIMESTAMP`, `SCHEMA_SEQUENCE` and
`REPLICATION_SEQUENCE` are not read by `import`. Tables missing from the tar
are simply left empty. Tables in other schemas are named with the schema
prefix (`cover_art_archive.art_type`).

**So a bootstrap e2e that runs the real mbslave against seam 3 is feasible.**
Cost: the test needs an image with Python, mbslave and `psql` (about 660 MB
with the compiler layer used here, much less with a multi-stage build), 12 to
40 s for `init --empty`, and a fixture of about 80 KB. It cannot use plain
`init`, which is one more reason the spec's "runs mbslave's own init/import
flow" has to become "runs `init --empty` and then `auto-import` or `import`"
(see the [impact](#impact-on-the-spec-55)).

`[schemas] ignore=` and `[tables] ignore=` in `mbslave.conf` skip whole
schemas and tables, both in `init` and in `import`, and (for tables) in
replication packets too ([L509-512](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L509-L512)).
**[measured]**: with `ignore=statistics,event_art_archive,documentation,wikidocs`
those four schemas were not created, and with `ignore=recording_tag` that table
stayed empty after `import`. These two settings exist **only in the config
file**; their `read_env` is a no-op, so there is no environment variable for
them.


## 3. Which dump archives, and which SQL scripts?

### Archives

Listing of the 2026-09-30 full export
([`fullexport/20260930-002222/`](https://data.metabrainz.org/pub/musicbrainz/data/fullexport/20260930-002222/))
with what each archive is for, from the
[MusicBrainz Database Download](https://musicbrainz.org/doc/MusicBrainz_Database/Download)
page:

| Archive | Size (compressed) | Needed? | Why |
| --- | --- | --- | --- |
| `mbdump.tar.bz2` | 7.58 GB | **Yes** | "The core MusicBrainz database, including the tables for Artist, Release, Recording, etc." It also carries `replication_control` (1 row) and the `genre` list **[measured]**; the tag tables are not in it. |
| `mbdump-derived.tar.bz2` | 520 MB | **Yes** | "annotations, user ratings, user tags, and search indexes". The page says "you will certainly need this if you want genre data, since the association of genres with entities is done via user tags", which is what story 17 (genres and tags with fallback) needs. **[measured]** It holds `recording_tag` (7,346,802 rows), `release_group_tag` (5,021,523), `artist_tag` (767,289), `tag` (244,795), plus ratings and annotations. |
| `mbdump-cover-art-archive.tar.bz2` | 168 MB | Optional | Which releases actually have cover art (no images). Without it the cover art URL can only be built from the release MBID and may 404. `auto-import` always downloads it. |
| `mbdump-edit.tar.bz2` | 16.8 GB | **No** | Edit history. Skipping it is the whole point of the spec's "skipping edit history". Nothing else needs it. |
| `mbdump-editor.tar.bz2` | 85 MB | No | The page says it is needed "in a standalone (rather than mirror) setup", because annotations link to editors through foreign keys. mbslave is a mirror and creates no foreign keys. |
| `mbdump-stats`, `-event-art-archive`, `-cdstubs`, `-documentation`, `-wikidocs` | 121 MB, 559 KB, 64 MB, 26 KB, 7 KB | No | Not read by the catalog. `auto-import` downloads stats and event-art-archive anyway. |

The full export directory keeps only the last two runs (26 and 30 September
at the time of writing) and is produced "twice a week"
([INSTALL.md](https://github.com/metabrainz/musicbrainz-server/blob/master/INSTALL.md)).
Each run has `MD5SUMS`, `SHA256SUMS` and PGP signatures. **[source]**

**Licenses differ per archive** ([same page](https://musicbrainz.org/doc/MusicBrainz_Database/Download#Licenses)):
`mbdump.tar.bz2` and `mbdump-cdstubs` are CC0; `mbdump-derived`,
`-cover-art-archive`, `-edit`, `-editor`, `-event-art-archive` and `-stats` are
**Attribution-NonCommercial-ShareAlike 3.0**. Getting genres and tags means
using a non-commercial-licensed archive. See
[section 6](#6-what-does-the-metabrainz-replication-token-need).

The two archives differ from the sample in one more way: the sample is a
single `tar.xz`; the full export is two or three `tar.bz2`. Any "same code
path" for `sample` and `full` is therefore `mbslave import <list of URLs>`,
with the list chosen by `CATALOG_DATASET`.

### SQL scripts mbslave uses to create the MusicBrainz schema

They ship inside the package (`mbslave/sql/`,
[folder](https://github.com/acoustid/mbslave/tree/v31.0.1/mbslave/sql)), are
MIT licensed, and are executed by `mbslave psql -f <name>` in this order
([`mbslave_init_main`, L735-811](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L735-L811)):

1. superuser: `Extensions.sql`, `CreateSearchConfiguration.sql`
2. `CreateCollations.sql`, `CreateTypes.sql`
3. tables: `CreateTables.sql`, `caa/CreateTables.sql`, `eaa/CreateTables.sql`,
   `statistics/CreateTables.sql`, `documentation/CreateTables.sql`,
   `wikidocs/CreateTables.sql`
4. **data import happens here** (`auto-import`, skipped by `--empty`)
5. primary keys (`CreatePrimaryKeys.sql` and the `caa/`, `eaa/`, `statistics/`,
   `documentation/`, `wikidocs/` variants)
6. functions: `CreateFunctions.sql`, `CreateMirrorOnlyFunctions.sql`, `caa/`,
   `eaa/`
7. indexes: `CreateIndexes.sql`, `CreateMirrorIndexes.sql`, `caa/`, `eaa/`,
   `statistics/`
8. views: `CreateViews.sql`, `caa/`, `eaa/`
9. `CreateMirrorOnlyTriggers.sql`, then replication setup:
   `ReplicationSetup.sql` and `dbmirror2/dbmirror2.sql`

Not run on a mirror, by design: `CreateReplicationTriggers*.sql` (the master
side) and `CreateFKConstraints.sql` (mbslave never creates foreign keys).

**Reusing them for the e2e fixture** **[measured]**. The scripts are plain SQL
with `\set ON_ERROR_STOP 1` psql meta-commands, so a Node driver cannot run
them, but `psql` can. In a fresh database with an empty `musicbrainz` schema,
`mbslave print-sql <file>` (prints the script with schema remapping) piped to
`psql` with `PGOPTIONS='-c search_path=musicbrainz,public'` applied these eight
scripts in 4.4 s and produced 375 tables:
`Extensions.sql`, `CreateSearchConfiguration.sql`, `CreateCollations.sql`,
`CreateTypes.sql`, `CreateTables.sql`, `CreatePrimaryKeys.sql`,
`CreateFunctions.sql`, `CreateIndexes.sql`. Without the `search_path`
option, `CreateTables.sql` fails with `collation "musicbrainz" ... does not
exist`. Options for the app's Testcontainers setup: (a) copy the pinned
scripts into the repo and run them with `container.exec(['psql', ...])`, or
(b) build the test Postgres image from mbslave's own
[`Dockerfile.postgres`](https://github.com/acoustid/mbslave/blob/v31.0.1/Dockerfile.postgres),
which runs `mbslave init --empty` in `docker-entrypoint-initdb.d`. The schema
changes every year (see the impact section), so either way the pin is bumped
together with mbslave.

**How mbslave applies replication packets matters for the outbox design.** A
packet is applied as plain `INSERT`/`UPDATE`/`DELETE` statements, all inside
one database transaction that ends with a single commit
([`PacketImporter.process`, L503-550](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L503-L550)),
with `session_replication_role` left at its default. So triggers on the
MusicBrainz tables fire normally and their outbox rows commit atomically with
the packet, exactly as the spec assumes. During the *initial import* triggers
are disabled (`SET session_replication_role = 'replica'`,
[L301](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L301)),
which is why the spec installs its triggers after the restore.


## 4. Disk, RAM and time

### What was measured, and how

- **Sample (`CATALOG_DATASET=sample`): restored and indexed for real** on this
  laptop. Sizes from `pg_database_size`, `pg_relation_size`, `du` of the Sonic
  data directory, and `docker stats`.
- **Full (`CATALOG_DATASET=full`): not restored.** A 40-line script streamed
  `mbdump.tar.bz2` and `mbdump-derived.tar.bz2` of 2026-09-30 through a pipe and
  recorded, for every table, its uncompressed size and row count (it took 5,941 s
  and 373 s, limited by the 1.0 to 1.5 MB/s download). The restored size of
  each table was then estimated from the sample: for table *t*,
  `raw_full(t) x pg_total_size_sample(t) / raw_sample(t)`, with the sample-wide
  ratio (2.28) for tables the sample lacks. This is an **[extrapolated]**
  estimate; the sample skews toward a few artists, so treat it as +-25%.
- **Sonic at scale:** the 2.95 M sample documents were pushed five times under
  different object keys (about 16.1 M objects). This keeps the real term
  distribution but makes every posting list 5 to 6 times longer than it would be
  for 2.95 M distinct Recordings. It is a stress test of ingestion speed and
  query latency, not a perfect model of 40 M distinct Recordings.

### Sample (measured)

| Item | Size or time |
| --- | --- |
| Download `mbdump-sample.tar.xz` | 358.6 MB (4 min at 1.5 MB/s here) |
| Uncompressed | 1.71 GB, 237 tables |
| Restored Postgres database with indexes | **3.93 GB** (`pg_database_size`): 1.87 GB tables and TOAST + 2.04 GB indexes. `base/` on disk: 3.7 GB |
| WAL | 6.5 GB seen in `pg_wal` with `max_wal_size=8GB`; the setting bounds it (default 1 GB) |
| `mbslave init --empty` | 12 s |
| `mbslave import` (bytes to tables) | 3 min 14 s |
| Build the 2,948,134 Sonic documents (SQL below) | 196 s (15,000 documents/s, one stream) |
| Push them to Sonic, 8 connections, defaults | 224 to 268 s (11,000 to 13,000 documents/s) |
| Sonic `metadata` bucket after settling | **612 MB** of SST files (208 bytes per Recording), graph 1.4 MB. `du` shows up to +50% while compaction runs |
| RAM | Postgres 0.77 GB resident (`shared_buffers=1GB`); Sonic 0.15 to 0.33 GB resident, from empty to 16 M objects |

End to end on the sample: about 12 minutes if run one after the other, about 8
if document building and pushing overlap, and 5 to 6 GB of disk. Search
behaviour on it is described in section 7.

### Full (extrapolated)

| Item | Estimate | Basis |
| --- | --- | --- |
| Downloads | **8.10 GB** (core 7,577,615,628 B + derived 520,485,348 B); 8.27 GB with the optional Cover Art Archive archive (168,433,088 B) | `Content-Length` of the 2026-09-30 archives **[measured]** |
| Uncompressed | 28.3 GB (core 25.4 GB in 182 members, derived 2.85 GB in 38) | Streamed **[measured]** |
| Rows that matter | `recording` 40,393,216; `track` 58,166,762 (7.9 GB raw, the largest table); `url` 21,975,488 (2.7 GB); `release` 5,814,410; `artist_credit` 3,891,400; `l_recording_work` 7,921,893; `recording_tag` 7,346,802 | Streamed **[measured]** |
| Restored database with indexes, everything in the two archives | **about 64 GB** (range 48 to 80) | Ratio from the sample, per table |
| Same, only the tables the catalog reads | about 44 GB | `[tables] ignore=` (section 2) skips the rest, also in replication. Not tried on the full dump **[unverified]** |
| Reference | musicbrainz-docker asks for "Disk Space: 350 GB (or 100 without indexed search)" and "RAM: 16 GB (or 4 without indexed search)" for a full mirror with the website | [README](https://github.com/metabrainz/musicbrainz-docker#recommended-hardwarevm) **[source]** |
| Sonic `metadata` bucket | **8 to 13 GB** (40.4 M x 200 to 330 bytes); provision 20 GB for compaction | 208 B per Recording on the sample; 164 to 200 B per object in the 16 M stress test **[extrapolated]** |
| Sonic `lyrics` bucket | 3 to 12 GB for 4 to 14 M matched Lyrics | 300,000 synthetic 1.5 KB lyrics (130 distinct terms, drawn from the real vocabulary): 246 MB = 820 B per lyric, 5,850 pushes/s **[measured on synthetic text, +-50%]** |
| Lyrics text in Postgres | 15 to 50 GB if plain and synced text of every matched Recording is kept | 4 to 14 M matches x about 3.4 KB **[extrapolated]** |
| WAL | 1 GB default; more during the restore | `max_wal_size` |
| Temporary: LRCLIB unpacked | **260 GB** (or 308 GB if the gzip is also kept) | section 5 |
| **Steady state** | **about 120 GB** (64 + 30 + 20 + WAL) | |
| **Peak during the first Lyrics import** | **about 400 GB** | steady state + 8 GB dumps + 260 GB LRCLIB file |

Provisioning suggestion for the app's CLAUDE.md: **at least 500 GB of SSD** for
`full` if the LRCLIB dump is unpacked on the same disk, or about 200 GB if a
separate scratch volume is used for it. `sample` needs about 6 GB.

**RAM (`full`)**: Sonic's resident memory stayed between 0.15 and 0.33 GB for
16 M objects with the default settings (0.6 to 0.8 GB tuned), so its cost is the OS page cache for its 12 to 25 GB of files
(query latency, next section). Postgres wants at least the 2 to 4 GB of
`shared_buffers` that MusicBrainz's own compose file uses ("Postgres shared buffers are set to 2GB by default",
[README](https://github.com/metabrainz/musicbrainz-docker#create-database)).
Practical minimum for the whole stack: **8 GB**; 16 GB is comfortable and lets
the document-building queries stay mostly in memory. mbslave (Python, streaming
`tarfile` and `COPY`) and the Node processes were not profiled **[unverified]**.

### How long would the first import take on `full`?

| Step | Sample (measured) | Full (extrapolated) |
| --- | --- | --- |
| Download 8.1 GB | 4 min for 0.36 GB | 1.5 to 2.2 h at the 1.0 to 1.5 MB/s seen here; 3 min at 50 MB/s |
| Restore (`import`) | 194 s for 1.71 GB raw (8.8 MB/s) | 28.3 GB / 8.8 MB/s = **about 55 min** (1 to 2.5 h: bzip2 decodes slower than xz, and indexes exist before the load, see section 1) |
| Build Sonic documents | 196 s | 40.4 M / 15,000 per s = 45 min if cached, up to about 3 h if the 64 GB database no longer fits in RAM |
| Push to Sonic | 11,000 to 13,000/s for the first 3 M objects (defaults) | Defaults: **3,000 to 4,500/s** past a few million objects, so 40.4 M takes **2.5 to 4 h**. Tuned RocksDB: 14,000/s falling to 9,000/s at 12 M objects, so **1 to 3 h** (see below) |
| Lyrics import and match | n/a | download 47.6 GB (about 50 min at the 16 MB/s seen from LRCLIB's CDN during a 2 GB partial download, 16 min at 50 MB/s, 9 to 13 h at the 1.0 to 1.5 MB/s seen from MetaBrainz), gunzip 260 GB, match, copy, push |

**Sonic ingestion slows down after the first few million objects** with its
default RocksDB settings. Time to push the same 2.95 M documents again, each
time under new keys: 253 s, 652 s, 913 s, 886 s and 712 s for copies 1 to 5
(11,700 to 3,200 documents/s). RocksDB's own log shows why: `Stalling writes
because we have 21 level-0 files` and `Stopping writes because we have 2
immutable memtables (waiting for flush), max_write_buffer_number is set to 2`,
with `max_background_jobs: 2` and a 16 MiB write buffer (Sonic's defaults, all
configurable in `CONFIGURATION.md`). **With the RocksDB settings tuned for bulk writes** (256 MiB write buffer, up to 4
buffers, 8 background jobs, 8 flush/compaction threads, level-0 triggers 8 / 48 /
64; the exact variables are in section 7) the same four copies took 206 s, 213 s,
215 s and 331 s (14,300, 13,900, 13,700 and 8,900 documents/s up to 11.8 M
objects), two to four times faster than the defaults at the same size, at the
price of 0.6 to 0.8 GB of resident memory instead of 0.15 to 0.33 GB
**[measured]**. The rate still falls as the index grows (the fourth copy was
40% slower than the third), so 40.4 M documents are an **[extrapolated]** 1 to 3
hours with the tuned settings.

So "how long does the initial Sonic indexing take": **3 to 6 minutes for the
sample, and on `full` 1 to 3 hours with tuned RocksDB settings (2.5 to 4 hours
with the defaults)**, extrapolated from the rates seen up to 16 M objects. The
whole first import of the MusicBrainz data is realistically **4 to 8 hours** on
this network and one machine (download about 2 h here, restore 1 to 2.5 h, Sonic
1 to 3 h, the last two overlapping with document building); the Lyrics import
comes on top.


## 5. The LRCLIB dump: where, format, size, cadence, detection

**Short version: it is one 47.6 GB gzip of a 260 GB SQLite file, published
irregularly by hand, with no incremental form. That is the riskiest finding of
the spike for the Lyrics part of the spec.**

### Where it is published

- Human page: <https://lrclib.net/db-dumps>. It is a client-side app; the file
  list comes from an undocumented Cloudflare Worker,
  `https://lrclib-db-dumps.bu3nnyut4y9jfkdg.workers.dev`, whose URL is in the
  site's JavaScript bundle. **[measured]** It answers with JSON:

  ```json
  {"objects":[{"key":"lrclib-db-dump-20260923T042405Z.sqlite3.gz",
               "size":47588708546,"uploaded":"2026-09-23T05:00:58.879Z",
               "etag":"3038f3c64308d147157a83ec1b0e7d06-2837", "...":"..."}],
   "truncated":false}
  ```

- Files are served from `https://db-dumps.lrclib.net/<key>` (Cloudflare,
  `accept-ranges: bytes`, `last-modified` set). Only **one** dump is listed at
  a time: the latest. **[measured]**
- There is no `LATEST` pointer file and no checksum file next to the dump
  (`/LATEST`, `/latest`, `/list.json`, `/index.json`, `<key>.sha256` and
  `<key>.md5` all return 404). A user asked for checksums in
  [lrclib#73](https://github.com/tranxuanthang/lrclib/issues/73) (open).
  **[measured]**
- Not part of the documented API: <https://lrclib.net/docs> does not mention
  dumps. The listing endpoint is therefore an **unofficial contract**.

### Format and schema

- gzip of a raw SQLite 3 database file (`.sqlite3.gz`). **[measured]**
  Decompressing the first bytes of the file gave the SQLite header: page size
  4096, 63,572,513 pages, so **260.4 GB uncompressed**, `user_version = 7`
  (header consistency check passed).
- Schema, from the server's
  [migrations](https://github.com/tranxuanthang/lrclib/tree/main/server/migrations)
  and confirmed against the dump's own `sqlite_master` **[measured]**:
  - `tracks(id, name, name_lower, artist_name, artist_name_lower, album_name,
    album_name_lower, duration FLOAT, last_lyrics_id, created_at, updated_at)`,
    unique on `(name_lower, artist_name_lower, album_name_lower, duration)`.
    `duration` is in **seconds**.
  - `lyrics(id, track_id, plain_lyrics, synced_lyrics, has_plain_lyrics,
    has_synced_lyrics, instrumental, source, created_at, updated_at,
    lyricsfile, has_lyricsfile)`. `synced_lyrics` is LRC text; `lyricsfile` is
    a YAML document (added in migration 5) that repeats the lyrics with
    word-level timing.
  - `missing_tracks`, `flags`, an FTS5 table `tracks_fts` with triggers,
    Litestream bookkeeping tables and `sqlite_stat1/4`.
- **The schema drifts and the dump can be ahead of the public code.** `user_version`
  went 4 to 5 (lyricsfile) and is 7 now. The server refuses newer dumps with
  `DatabaseTooFarAhead` ([#104](https://github.com/tranxuanthang/lrclib/issues/104),
  [#106](https://github.com/tranxuanthang/lrclib/issues/106)); the maintainer
  pushed the matching code more than a month later. An importer must select
  columns by name from `tracks` and `lyrics` and must not depend on
  `user_version`.
- License: the LRCLIB site says its data is "dedicated to the public domain
  under CC0" (lrclib.net home page). The copyright status of the lyrics text
  itself was not researched here.

### Size

| | Size |
| --- | --- |
| Dump download (`.sqlite3.gz`) | 47,588,708,546 bytes = 47.6 GB = 44.3 GiB **[measured]** |
| Uncompressed SQLite file | 260.4 GB **[measured]** |
| Same dump in October 2025 | "17G" ([#73](https://github.com/tranxuanthang/lrclib/issues/73), dump `20251022T074101Z`) **[source]**, so 2.8x in 11 months |
| Records | Highest `lyrics.id` reachable through the API is about 38.9 million (binary search, 10 requests). 86% of 291 random ids in `1..38,882,559` existed. So roughly **33 million** lyrics records **[extrapolated]** |
| Per record (250 random records through the API) | plain lyrics mean 1.4 KB (max 5.0 KB in this sample), synced 2.0 KB, `lyricsfile` 3.7 KB, together 6.2 KB. 6.2 KB x 33-39 M = 200-240 GB, consistent with the 260 GB file **[measured + extrapolated]** |

Consequences for disk: a plain "download, gunzip, read" needs about 308 GB
peak (47.6 + 260). Streaming with `curl ... | gunzip > lrclib.sqlite3` needs 260
GB. Reading with SQLite needs random access, so the decompressed file must exist
on disk while the import runs. Copying all lyrics into Postgres without
`lyricsfile` would add about 33 M x 3.4 KB = 110 GB of text before indexes
**[extrapolated]**, which is more than the MusicBrainz database itself. Only
the Lyrics that match a Recording are needed (story 39), so the import should
read `tracks` first (about 39 M small rows), match, and copy lyrics text only
for matched tracks.

### Publishing cadence

There is no schedule. The dumps I could date from file names in the issue
tracker and the listing **[source]** are 2025-10-22, 2026-04-10, 2026-05-19,
2026-06-04 and 2026-09-23. Between the ones I know of, the gaps are 39 days
(Apr 10 to May 19), 16 days (May 19 to Jun 4) and about 3.7 months (Jun 4 to
Sep 23); there may be dumps in between that I did not see, because only the
latest is kept online. The maintainer said in July 2025 that he "still has to
manually create the dump file and upload" it and that a SQLite `.backup` of the
live database once ran overnight without finishing until he reduced writes
([#52](https://github.com/tranxuanthang/lrclib/issues/52)). Plan for "a new
dump every few weeks to few months, sometimes late, never guaranteed".

### How a new dump can be detected

1. **Poll the listing JSON** (above) and compare `key`, `etag` or `uploaded`
   with the last imported one. The key embeds the timestamp
   (`YYYYMMDDTHHMMSSZ`), so it also orders dumps. Unofficial; if the Worker
   disappears, detection breaks silently, so alert on HTTP errors.
2. `HEAD https://db-dumps.lrclib.net/<known key>` to check the object still
   exists and to read `etag` and `last-modified` (needs the key from 1).
3. There is nothing to diff: no incremental dumps and no change feed. Every
   refresh is a full 47.6 GB download and a full re-read. The per-record
   `updated_at` columns exist in the file, so after a new dump the import can
   reindex only records whose `updated_at` moved (as the spec intends), but
   the download and gunzip cost is paid in full each time.

### Range requests and integrity

A `Range: bytes=0-99` and a `bytes=0-1999999` request both answered `206
Partial Content` with the right `content-range: bytes .../47588708546`
**[measured]**, so resumable downloads are possible. One earlier ranged request
(`0-2000000`) was answered with the full body instead (stopped after 2 GB);
it could not be reproduced, so treat resume as best effort **[unverified]**.
Without published checksums the only integrity check is the gzip CRC (checked
at the end of the stream) and a `PRAGMA integrity_check`/`quick_check` on a
260 GB file.

### Alternative for small numbers: the API

`GET https://lrclib.net/api/get?artist_name=...&track_name=...&album_name=...&duration=...`
and `/api/search` need no key but require a descriptive `User-Agent`, answer
`429` with `Retry-After` when limited, and recommend 200 to 500 ms between
requests ([API docs](https://lrclib.net/docs)). At that pace 2.95 M sample
Recordings would take 7 to 17 days, so it is not a bulk route, but it is a
reasonable way to look up Lyrics for the few Recordings that appear between two
dumps (story 38).

### How many Recordings would get Lyrics?

**[measured]**: 200 random sample Recordings with a length were searched
through the API (`/api/search?track_name=&artist_name=`), sequentially, 0.6 s
apart, and the results were filtered with the spec's rule (normalized title
and artist equal, duration within 2 s):

| Filter | Recordings |
| --- | --- |
| Any candidate returned | 64 / 200 (32%) |
| Normalized title and artist equal | 61 / 200 (30.5%) |
| ... and duration within 2 s | 41 / 200 (20.5%) |
| ... and has plain or synced text | 38 / 200 (19%) |
| ... and has synced text | 32 / 200 (16%) |

Caveats: the sample is skewed (classical, live bootlegs), the API search is
fuzzy and returns a limited page, and normalization here was a simple
NFKD/lowercase/strip-punctuation. Read it as "somewhere between 10% and 35% of
Recordings will get Lyrics", which would be about 4 to 14 million of the 40.4
million; the ±2 s rule removes a third of the title-and-artist matches.


## 6. What does the MetaBrainz replication token need?

- **An account.** A MetaBrainz account with a verified email address
  ("You will need a MetaBrainz account with a verified email address to sign-up",
  [MetaBrainz supporter page](https://metabrainz.org/supporters/account-type)).
  Signing up associates it with an existing or new MusicBrainz account ([2015 announcement](https://blog.metabrainz.org/2015/05/18/new-metabrainz-site-new-look-and-live-data-feed-access-tokens/)). The token
  is generated on the account's profile page: "All endpoints require an access
  token which you can get from your profile page"
  ([MetaBrainz API](https://metabrainz.org/api/)). A token is 40 characters
  (musicbrainz-docker's `admin/set-replication-token` rejects any other
  length). **[source]**
- **The tier depends on commercial use, and that is not our call to make.**
  Replication packets are "licensed under the Creative Commons
  Attribution-NonCommercial-ShareAlike 3.0 license. Non-commercial / personal
  users may sign up and obtain a free access token"
  ([Live Data Feed](https://musicbrainz.org/doc/Live_Data_Feed)). For a company
  with, or expecting, a revenue stream, the supporter page lists tiers:
  Non-profit ($0.00/month and up), Stealth Start-Up ($0.00 and up), Bronze
  ($100 and up), Silver ($600), Gold ($1,250), Unicorn ($2,000). The same page tells "a pre-revenue start-up and expect to have revenue in the future" to "sign up with a commercial account". The Live Data Feed page adds "MetaBrainz does not charge
  for access to the data. However, we ask that commercial users support our
  efforts financially." **[source]** Whether notefinder counts as commercial,
  and which tier, is a maintainer decision (flagged in the impact section).
  This is not legal advice.
- **How it is used.** Packets: `GET
  https://metabrainz.org/api/musicbrainz/replication-<N>-v2.tar.bz2?token=<T>`
  (`.asc` for a signature); latest number: `GET
  .../replication-info?token=<T>`. There is also an hourly incremental JSON
  dump endpoint, unused here. **[source]** ([API page](https://metabrainz.org/api/))
- **What the server answers without a valid token** **[measured]**: no token is
  HTTP 400 `You need to provide an access token!`; a wrong token is HTTP 403
  `Provided access token is invalid!`. mbslave only handles 404
  ([L599-602](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L599-L602));
  a 403 raises an `HTTPError` and the process exits, so a bad or revoked token
  shows up as a crash-looping container with a clear log line, not as silence.
- **How mbslave takes it** **[source]** (`MusicBrainzConfig`,
  [L165-179](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L165-L179)):
  the environment variable `MBSLAVE_MUSICBRAINZ_TOKEN`, or
  `MBSLAVE_MUSICBRAINZ_TOKEN_FILE` (path to a file, contents stripped; better
  for Docker secrets), or `token=` in the `[musicbrainz]` section of
  `mbslave.conf`. It is appended as the `?token=` query parameter, and the log
  line redacts it (`token=***`) **[measured]**.
- **No token is needed to download dumps.** The sample and the full export were
  fetched without any credential **[measured]**. The licenses above still apply.
- **Cadence and catch-up.** Packets are produced "at hourly intervals" and a
  mirror is never "more than about an hour off sync" **[source]**. After
  restoring a dump that is up to a few days old (full exports are twice a week),
  the first `sync` has to apply every packet since the dump's
  `REPLICATION_SEQUENCE` (188,657 for the 2026-09-01 sample): up to about 100
  packets for a 4-day-old dump **[extrapolated]**. `sync` processes them one at a
  time; with `--keep-running` it sleeps 10 minutes when the next packet does not
  exist yet ([L637-643](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L637-L643)).
- **Once a year replication stops until someone upgrades.** "When the
  MusicBrainz database schema changes, the replication will stop working"
  ([mbslave README](https://github.com/acoustid/mbslave#schema-upgrade)). The
  last change was schema 31, release 2026-05-11; the procedure is `mbslave psql
  -f updates/schema-change/31.all.sql` and `UPDATE replication_control SET
  current_schema_sequence = 31`, using the matching mbslave tag. Until then
  `sync --keep-running` logs `Schema mismatch, sleeping` every 10 minutes
  ([L631-636](https://github.com/acoustid/mbslave/blob/v31.0.1/mbslave/replication.py#L631-L636)).
  The next change is expected around May 2027 **[extrapolated from the yearly
  pattern in the README]**. This is the one recurring manual step in a service
  that is otherwise meant to need only `docker compose up -d`.


## 7. Does Sonic return results by relevance, and what are its limits?

**Ordering: confirmed.** **Usability at this catalog size with Sonic's
defaults: not confirmed. Two default settings make search return nothing or the
wrong things, and they have to be changed before the first document is
indexed.** Details below; the numbers are for the restored sample (2.95 M
Recordings) unless stated.

Tested version: Sonic **v1.10.1** (2026-09-26, the `latest` image;
[changelog](https://github.com/valeriansaliou/sonic/blob/v1.10.1/CHANGELOG.md)).
This is not the Sonic 1.4 most blog posts describe: since 1.7 it ranks results
by score instead of returning them in reverse insertion order.

### Ordering

- **Sorted by score, best first.** The executor collects candidate documents
  with a per-term score (BM25-style idf weight of an exact match, or a
  Levenshtein-based score for prefix and typo matches), sums the scores over the
  query terms, sorts descending, and only then applies `OFFSET` and `LIMIT`
  ([`core/src/executor/search.rs`](https://github.com/valeriansaliou/sonic/blob/v1.10.1/core/src/executor/search.rs),
  `all_iids.sort_by(...)` then `.skip(offset)`; description in
  [`docs/search-results-ranking.md`](https://github.com/valeriansaliou/sonic/blob/v1.10.1/docs/search-results-ranking.md),
  which is slightly older than the code). **[source]**
- **Black-box check [measured].** After pushing "Yesterday The Beatles Help!",
  "Yesterday Once More Carpenters" and "Let It Be The Beatles", the query
  `yesterday beatles` returned them in this order: the document that contains
  both terms, then the one that matches only `yesterday`, then the one that
  matches only `beatles`.
- **Multi-term queries are OR, not AND.** A document that matches one term is
  returned, ranked below documents that match more terms (see the previous
  point). The one exception is described in finding 2 below.
- **Ties are broken by reverse insertion order**: the most recently pushed
  document comes first ([ranking doc](https://github.com/valeriansaliou/sonic/blob/v1.10.1/docs/search-results-ranking.md#ranking-algorithm);
  **[measured]**: with equal scores the later push came first). Consequence:
  re-indexing a Recording (`FLUSHO` then `PUSH`) moves it to the front among
  its equals. For a catalog with thousands of Recordings titled identically
  (2,145 "Born to Run" in the sample) which one appears first is arbitrary.
- **Updating a document is `FLUSHO` + `PUSH`** (or `POP` with the exact old
  text). There is no `UPDATE` command
  ([PROTOCOL.md](https://github.com/valeriansaliou/sonic/blob/v1.10.1/PROTOCOL.md#4%EF%B8%8F%E2%83%A3-sonic-channel-ingest-mode)).
  **[measured]**: after `FLUSHO`, the old terms no longer matched; after a new
  `PUSH` only the new terms matched; `FLUSHO` on an unknown object answers
  `RESULT 0`, not an error. Between the two commands the Recording is absent
  from search results. Upstream issue
  [sonic#363](https://github.com/valeriansaliou/sonic/issues/363) (open) reports
  that `FLUSHO` leaves orphan terms in the index's term count; search results
  were correct in the test above.

### Limits relevant to the design

| Limit | Value | Notes |
| --- | --- | --- |
| Size of one command line (`PUSH <collection> <bucket> <object> "<text>"\n`) | **20,000 bytes** (`buffer(20000)` in the `STARTED` reply; [`handle.rs` L44](https://github.com/valeriansaliou/sonic/blob/v1.10.1/server/src/channel/handle.rs#L44)) | **[measured]** A 19,928-byte command was accepted. A 20,028-byte one was **not rejected with an error: the server logged `buffer overflow (20028/20002 bytes)` and closed the connection** without a reply. |
| Max text per push | About **19,900 bytes minus the command prefix** (`PUSH ` + collection + bucket + 36-byte MBID + quotes, roughly 60 bytes) | Text must be escaped (`\` becomes `\\`, `"` becomes `\"`, newlines must be removed) and escaping makes it longer. Use chunks of at most 18,000 bytes of text. |
| Long text | Several `PUSH`es for the same object **accumulate** | **[measured]**: terms of the first and second push were both found for the same object; `COUNTO` returned the union. LRCLIB plain lyrics were at most 5.0 KB in a 250-record sample, so chunking is a safety net, not the normal path. |
| Object key | 1 to **128 ASCII bytes**, no whitespace ([`types.rs` L103-110](https://github.com/valeriansaliou/sonic/blob/v1.10.1/core/src/store/types.rs#L103-L110)) | **[measured]** A 36-character MBID with hyphens (`b1a9c0e9-d987-4042-ae91-78d6a3267d69`) is accepted, so is a 128-character key. A 129-character key or a non-ASCII key returns `ERR invalid_argument(InvalidObject)`. Collection and bucket names follow the same rule. |
| `QUERY ... LIMIT(n)` | `1 <= n <= search.query_limit_maximum` (default **100**) | **[measured]** `LIMIT(0)` and `LIMIT(101)` both return `ERR policy_reject(LIMIT out of minimum/maximum bounds)`; the value is **not clamped**. Default limit when omitted: `query_limit_default` = 10. |
| `QUERY ... OFFSET(n)` | `u32`, no dedicated cap | **In practice `OFFSET + LIMIT` cannot pass `store.kv.retain_word_objects` (default 1,000)**, see finding 1: paging with `LIMIT 100` for a common term stopped at exactly 1,000 results (`born to run`, `love`, `beatles`, `springsteen`, `yesterday`, `yesterday beatles`). |
| Candidate set | `store.kv.retain_word_objects`, default **1,000** ([`search.rs` L149-152](https://github.com/valeriansaliou/sonic/blob/v1.10.1/core/src/executor/search.rs#L149-L152)) | The doc comment in `CONFIGURATION.md` describes it as a sliding window on the index; in v1.10.1 the code uses it only as a cap on the candidates collected per query. |
| Connection | One command at a time per connection; `QUERY` is asynchronous (`PENDING <id>` then `EVENT QUERY <id> <oids...>`); idle timeout `channel.tcp_timeout` = 300 s | An empty result is `EVENT QUERY <id> ` with an empty list (a client must not treat the empty string as an object key). |
| Auth | `START <mode> <password>` per connection, `channel.auth_password` | Modes `search`, `ingest`, `control` are separate connections. |

Everything above was configured **only with `SONIC_*` environment variables**
(no config file mounted), which works for every key in `CONFIGURATION.md`:
`SONIC_CHANNEL__INET=0.0.0.0:1491`, `SONIC_CHANNEL__AUTH_PASSWORD`,
`SONIC_STORE__KV__PATH`, `SONIC_STORE__FST__PATH`, and so on (path separator
`__`). The image is `gcr.io/distroless/cc` based, 19.8 MB, amd64 and arm64,
runs as root with working directory `/usr/src/sonic`, and has **no shell and no
`nc`**, so a Docker `healthcheck` cannot run inside it. **[measured]**

### Finding 1: the candidate cap wrecks recall (setting: `retain_word_objects`)

Sonic looks up the documents of the first query term, then the second, and so
on, inserting them into a candidate table until the table holds
`retain_word_objects` entries, and then **stops looking at further terms**.
Documents are scored only after that. A common first term (an artist with
65,000 Recordings) therefore fills the table with its 1,000 most recently
pushed documents and the rest of the query cannot add new candidates, only
raise the scores of documents already in the table.

**[measured]** Same 2.95 M documents, same 700 queries, three values of
`retain_word_objects` (a query text built from a real Recording's title and
artist credit, the expected answer is that Recording's MBID; `random` = 400
random Recordings that are on a release, `heavy-artist` = 300 Recordings with a
title used at most 20 times by Bruce Springsteen, Elvis Presley, The Beatles,
Bob Dylan or Pink Floyd, artists with 9,652 to 65,683 Recordings each).
Recall is the share of queries whose expected Recording is in the top 1 / 10 /
100. Every row uses the tuned tokenizer settings of finding 2 (index rebuilt), except the row marked default tokenizer. Identical Recordings (many live takes share a title and artist) make 100%
unreachable, so read the columns against each other, not against 100%.

| `retain_word_objects` | Query set and text | recall@1 | recall@10 | recall@100 | latency p50 / p95 / p99 |
| --- | --- | --- | --- | --- | --- |
| 1,000 (default), **default tokenizer** | random, title + artist | 9.5% | 14.0% | 20.3% | 7 / 18 / 40 ms (but 134 of 400 queries returned nothing, finding 2) |
| 1,000 (default) | random, title + artist | 10.5% | 16.3% | 24.5% | 17 / 113 / 158 ms |
| 1,000 | heavy-artist, title + artist | 2.3% | 7.3% | 22.3% | 11 / 116 / 145 ms |
| 1,000 | heavy-artist, **artist + title** | 0.0% | 0.0% | **0.0%** | 10 / 36 / 42 ms |
| 100,000 | random, title + artist | 36.8% | 55.8% | 68.3% | 19 / 146 / 240 ms |
| 100,000 | heavy-artist, artist + title | 28.3% | 56.7% | 77.7% | 18 / 39 / 104 ms |
| 1,000,000 | random, title + artist | 65.5% | 87.0% | 97.0% | 36 / 772 / 1,256 ms |
| 1,000,000 | random, artist + title | 65.5% | 86.8% | 97.0% | 106 / 964 / 2,198 ms |
| 1,000,000 | heavy-artist, title + artist | 48.7% | 77.3% | 93.3% | 123 / 369 / 538 ms |
| 1,000,000 | heavy-artist, artist + title | 47.7% | 76.7% | 93.0% | 42 / 235 / 401 ms |

Latency was measured one query at a time on an otherwise idle Sonic over
localhost. **At the default the term order in the user's query decides whether a
song can be found at all** (0% for "artist title" on a big artist), and 100,000
is still not enough for a 3 M document index. On a 16.1 M-object stress index (five copies of the sample, section 4) the same kind of query took, with `retain_word_objects` = 1,000,000: p50 372 ms and p95 1.5 s for random title + artist queries (p50 292 ms, p95 725 ms for heavy artists); with 10,000,000: p50 550 ms, p95 5.9 s, p99 7.4 s (heavy artists 356 ms, 1.9 s, 2.4 s). The first query after a restart took 31 to 37 s (cold page cache). A value that covers the commonest terms of a 40 M Recording catalog therefore costs seconds at the tail, and Sonic offers no way to rank without loading the candidates first.

### Finding 2: numbers in a query produce empty results (setting: `detect_special_patterns`)

With the default `tokenization.detect_special_patterns = true`, a query that
contains a token Sonic considers a special pattern (numbers such as `1`, `37`,
`488` count) switches to **implicit AND across all terms**
([`search.rs` L253-269](https://github.com/valeriansaliou/sonic/blob/v1.10.1/core/src/executor/search.rs#L253-L266)).
Combined with finding 1 the result is often empty. **[measured]** On the 2.95 M
index, default settings:

- `pigs on the wing part 1` returned 0 results (thousands of matching
  Recordings exist); `pigs on the wing` returned results; `1` alone returned
  results; `part 1` returned 0.
- `piano concerto no 3`, `piano concerto op 37`, `K 488` and `Pigs on the Wing,
  Part 1 Pink Floyd` returned 0.
- **134 of 400 random title + artist queries returned nothing** (33.5%),
  almost all with a number or an opus in them.

Setting `SONIC_TOKENIZATION__DETECT_SPECIAL_PATTERNS=false` and re-indexing
turned all of these into normal OR queries: **0 of 400 empty** (1 of 400 for
title only), and `Pigs on the Wing, Part 1 Pink Floyd`, `K 488` and `piano
concerto no 3` returned results. Raising `retain_word_objects` alone fixed only
some of them (with 100,000: `part 1` and `K 488` worked, `piano concerto no 3`
and the Pink Floyd query still returned 0). The setting has to be chosen
**before** the first document is pushed (the configuration reference says
tokenization changes need a re-index).

### Other configuration findings **[measured]** unless noted

- **`normalization.unicode_normalization = "nfkc"` (recommended in
  `CONFIGURATION.md`) crashes Sonic at startup** in v1.10.1:
  `syntax error in config: unexpected string value: nfkc for key
  normalization.unicode_normalization`, from the config file and from
  `SONIC_NORMALIZATION__UNICODE_NORMALIZATION`, for `nfkc`, `Nfkc`, `NFKC` and
  `Nfc`. The helper that reads the setting
  ([`serde.rs` L8-32](https://github.com/valeriansaliou/sonic/blob/v1.10.1/core/src/util/serde.rs#L8-L32))
  treats every string other than `none` as an error. Only `none` works
  today. Not found in the upstream issue tracker.
- **`diacritic_folding_enabled = true` works** and is what music search wants:
  `bjork` finds "Björk", `beyonce` finds "Beyoncé". Curly and straight
  apostrophes are both dropped, so `dont stop believin` finds "Don’t Stop
  Believin’" and "Don't Stop Me Now". Japanese and Cyrillic titles match
  themselves; transliterations (`kino` for "Кино") do not match.
- **Prefix and typo matching only cover the first words.** The per-bucket
  graph is capped at `store.fst.graph.max_words = 250,000` and
  `max_size = 2,048` KB by default; after that new words are not added to it
  ([`fst/mod.rs`](https://github.com/valeriansaliou/sonic/blob/v1.10.1/core/src/store/fst/mod.rs)).
  The 2.95 M Recording index reached the cap (`fst has exceeded maximum allowed
  words: 250000` in the log; the graph file was 1.4 MB). Exact-word lookups use
  the key-value store and are unaffected. The caps can be raised, at the price of
  rebuilding the whole graph at every consolidation (FST files are immutable,
  [INNER_WORKINGS.md](https://github.com/valeriansaliou/sonic/blob/v1.10.1/INNER_WORKINGS.md)).
  Raising them was **not tested [unverified]**.
- **Stopwords and language detection** are automatic: short titles made only of
  stopwords (`The The`, `You`, `It`, `La La La`, `99`) were found in a toy test
  with auto-detection and with `LANG(none)` alike. Not tested at scale.
- **Log level.** `SONIC_SERVER__LOG_LEVEL=info` logs the language detection line
  with the **indexed text** for every push. Leave it at the default `error`.
- **Durability.** With the default write-ahead log, 20,000 acknowledged pushes were all present after `docker kill -s KILL` and restart, and 25,000 after `docker stop`. An operating system crash or power loss was not tested **[unverified]**, so the spec's indexing checkpoint (story 33) should checkpoint conservatively (for example resume a few batches before the recorded position; pushing the same document twice is harmless).
- **Noise on stdout.** During bulk ingestion Sonic v1.10.1 prints RocksDB merge-operator debug lines (`i32_counter(None, 1,1,1,...)`, some thousands of characters long) regardless of `log_level`: 704 lines in one run. Cap Docker log size on that container.
- **Object identity and hashes.** Object keys map to sequential 32-bit
  internal ids; terms are keyed by a 32-bit hash, so different words can
  collide. Upstream tracks this in
  [sonic#377](https://github.com/valeriansaliou/sonic/issues/377) and plans a v2
  ([#373](https://github.com/valeriansaliou/sonic/issues/373)), so a future
  major upgrade may need a full re-index. **[source]**
- **Client library.** The `sonic-channel` npm package is MIT with no dependencies
  but its last release (1.3.1) was in January 2023 **[checked]**. The protocol is
  small enough that the 60-line client used in this spike covers `START`,
  `PUSH`, `QUERY`, `FLUSHO`, `FLUSHC`, `COUNTB`; decide in the Sonic-client
  ticket.

### Calibration: Postgres full-text search on the same data **[measured]**

To see what the Sonic numbers mean, the same 2,948,134 documents were loaded
into one Postgres table as `tsvector` (the `mb_simple` configuration that
MusicBrainz's own scripts create, which folds accents like the Sonic setting
above), with a GIN index (loaded in 112 s, index 200 MB, table 1.8 GB), and the
same 700 queries were run with `plainto_tsquery` (AND of all terms) ordered by
`ts_rank_cd`, `LIMIT 100`:

| Query set and text | recall@1 | recall@10 | recall@100 | latency p50 / p95 / p99 |
| --- | --- | --- | --- | --- |
| random, title + artist | 77.2% | 91.2% | 98.8% | 3.7 / 29 / 88 ms |
| random, artist + title | 77.2% | 91.2% | 98.8% | 2.7 / 23 / 32 ms |
| random, title only | 43.8% | 66.8% | 86.5% | 10 / 275 / 2,493 ms (max 7.0 s) |
| heavy-artist, title + artist | 63.0% | 89.3% | 99.3% | 10 / 55 / 120 ms |
| heavy-artist, artist + title | 63.0% | 89.3% | 99.3% | 6.5 / 28 / 49 ms |
| heavy-artist, title only | 59.0% | 80.0% | 94.7% | 4.9 / 95 / 381 ms (max 16.0 s) |

This is an **idealized** comparison: each query is built from the target
document, so an AND query always contains it; misspelled or differently
worded queries would return nothing, and there is no prefix or typo matching.
Ranking every match for a very common single word is the slow case (the
multi-second tails). It is a calibration point for the maintainer's decision,
not a replacement proposal: multi-term queries are one to two orders of
magnitude faster than Sonic at the 1,000,000 setting on the same data, with
equal or better recall.

### Recommended Sonic configuration, if Sonic stays

```sh
SONIC_SERVER__LOG_LEVEL=error
SONIC_CHANNEL__INET=0.0.0.0:1491
SONIC_CHANNEL__AUTH_PASSWORD=<secret>
SONIC_STORE__KV__PATH=/var/lib/sonic/store/kv/
SONIC_STORE__FST__PATH=/var/lib/sonic/store/fst/
SONIC_TOKENIZATION__DETECT_SPECIAL_PATTERNS=false     # before the first push
SONIC_NORMALIZATION__DIACRITIC_FOLDING_ENABLED=true   # before the first push
SONIC_STORE__KV__RETAIN_WORD_OBJECTS=<see finding 1>  # query-time only, can change without a re-index
# bulk-ingestion tuning (see section 4):
SONIC_STORE__KV__DATABASE__WRITE_BUFFER_SIZE=262144      # KiB; default 16384
SONIC_STORE__KV__DATABASE__MAX_WRITE_BUFFER_NUMBER=4
SONIC_STORE__KV__DATABASE__MIN_WRITE_BUFFER_NUMBER_TO_MERGE=2
SONIC_STORE__KV__DATABASE__MAX_BACKGROUND_JOBS=8
SONIC_STORE__KV__DATABASE__PARALLELISM=8
SONIC_STORE__KV__DATABASE__LEVEL_ZERO_FILE_NUM_COMPACTION_TRIGGER=8
SONIC_STORE__KV__DATABASE__LEVEL_ZERO_SLOWDOWN_WRITES_TRIGGER=48
SONIC_STORE__KV__DATABASE__LEVEL_ZERO_STOP_WRITES_TRIGGER=64
```


## Impact on the spec (#55)

This section is the spike's analysis as written before the maintainer's
decisions; [Decisions taken after this spike](#decisions-taken-after-this-spike)
records what was decided and where it differs from the proposals below.

Legend: **holds** = confirmed, no change; **changes** = still doable, the text
of the spec or a ticket has to change; **at risk** = the decision may not
survive without a maintainer decision (proposal given, nothing decided).

### At risk (need a maintainer decision before the tickets that depend on them)

1. **"Sonic only, no re-ranking" search (Search section).** With Sonic's
   defaults, 33.5% of real title-and-artist queries returned nothing and the
   right Recording was in the top 10 for 14% of them (16% once the empty-result
   setting is fixed but the candidate cap is not; 0% in the top 100 for "artist
   title" on a big artist). With the two settings fixed (findings 1 and 2) and
   `retain_word_objects` raised to 1,000,000, recall at 10 was 87% on the
   2.95 M index at a p95 latency of 0.8 to 1.0 s; on a 16 M-object stress index
   (five copies of the sample) p50 was 0.4 to 0.55 s and p95 1.5 to 5.9 s.
   Postgres full-text search on the same 2.95 M documents reached recall at 10 of
   89 to 91% with p95 22 to 55 ms on multi-term queries (an idealized case, see
   the calibration in section 7). Proposals, in the order I would try them:
   (a) keep Sonic with the tuned settings, and make the indexing ticket run the
   full-scale benchmark (40.4 M distinct documents, this query set) before the
   Search ticket is accepted; (b) keep Sonic only to produce a bounded
   candidate list and let the server rank those in Postgres, which contradicts
   "no re-ranking"; (c) replace Sonic with an engine that ranks all matches
   (Postgres full-text search, already in the stack, is the calibration point;
   a dedicated engine is the other option). Sonic was picked by the maintainer,
   so this is a question, not a recommendation to switch.
2. **Commercial use and the MetaBrainz token (Sync section, story 48).**
   Replication packets and the derived dump (tags and genres) are
   CC BY-NC-SA 3.0; a free token is for non-commercial use, and companies with
   or expecting revenue are asked to sign up to a commercial tier
   ([section 6](#6-what-does-the-metabrainz-replication-token-need)). The
   maintainer needs to decide whether notefinder is commercial, and if so which
   tier, before `full` mode is deployed. The core dump (recordings, artists,
   releases, works, URLs, `genre` list) is CC0; only `mbdump-derived` and the
   replication packets are NC-SA, so "core only, no genres, no sync" is a legal
   fallback, but it drops story 17's genres and story 34-35's sync.
3. **The LRCLIB import (Lyrics section, stories 37-39, 52).** 47.6 GB download,
   260 GB uncompressed SQLite file, no incremental form, irregular manual
   cadence, undocumented listing endpoint, schema that changes between dumps
   ([section 5](#5-the-lrclib-dump-where-format-size-cadence-detection)).
   "Import the dump into our schema" cannot mean "copy all lyrics into Postgres"
   (about 110 GB of text before indexes); it has to be a two-pass import that
   matches on `tracks` first and copies only matched lyrics. The server needs
   about 310 GB of free disk during the import (or 260 GB when streaming the
   gzip), which must be in the production sizing.
4. **`sample` mode Lyrics ("only the Lyrics that match imported Recordings are
   kept", story 52).** There is no way to fetch a slice of the LRCLIB dump: the
   whole gzip must be downloaded and unpacked to pick rows. That is
   impractical for a developer machine (hours of download, 260 GB of disk).
   Options: (a) publish once, from the maintainer's machine, a small LRCLIB
   slice for the current MusicBrainz sample in the same SQLite schema (a release
   asset or a bucket file) and point `LRCLIB_BASE_URL` at it in `sample` mode,
   so the importer is the same code path; (b) fill a few thousand Recordings
   through the LRCLIB API in `sample` mode (different code path, slow by
   design); (c) no Lyrics in `sample` mode. I would try (a).
5. **"No manual steps beyond `docker compose up -d`" (Problem statement,
   stories 29-31, 34).** Once a year MusicBrainz changes its schema and
   replication stops until someone upgrades mbslave and runs the schema-change
   script ([section 6](#6-what-does-the-metabrainz-replication-token-need)). The
   next one is expected around May 2027. Proposal: the mbslave image's
   entrypoint applies `updates/schema-change/<n>.all.sql` itself when it sees a
   `SCHEMA_SEQUENCE` mismatch and the script for that version ships in the
   image, and the release process bumps mbslave with the yearly
   MusicBrainz announcement. The Drizzle declarations of the MusicBrainz
   tables need the same yearly review.

### Changes

6. **"The worker runs mbslave's own init/import flow" (Bootstrap section).**
   `mbslave init` cannot take a custom URL, cannot load the sample, is not
   idempotent and needs Python, mbslave and `psql`, none of which are in the
   spec's single Node image. What works: `init --empty` then `import` (or
   `auto-import --mirror`). Proposal: the mbslave container owns the restore
   (entrypoint script: skip if the schema exists, else `init --empty`, `import`
   the archives for `CATALOG_DATASET`, then `sync --keep-running` in `full`
   mode) and the worker only waits for it (for example by polling for the
   `musicbrainz.replication_control` row in `full`); the alternative is adding Python, mbslave and the Postgres client
   to the worker image.
7. **Which archives (Bootstrap section).** Load `mbdump.tar.bz2` and
   `mbdump-derived.tar.bz2` with `import <url>...`; do not use `auto-import`,
   which also downloads `stats`, `event-art-archive` and `cover-art-archive`
   (about 290 MB more) and needs all five files to exist. The Cover Art
   Archive archive (168 MB) is optional and decides whether the cover art URL
   can be limited to releases that have art. In `sample` mode the CAA table
   stays empty (the sample names it without its schema) so the cover art URL can
   only be built from the release MBID.
8. **`limit`/`offset` in `search` (Protocol section).** Sonic accepts
   `LIMIT` from 1 to 100 (configurable) and rejects, not clamps, larger values;
   `OFFSET + LIMIT` cannot exceed `retain_word_objects`. Put `limit` max 100 and
   a fixed `offset` bound (for example `offset + limit <= 1,000`) in the
   contract schema regardless of the Sonic setting, and map Sonic's
   `ERR policy_reject` to `VALIDATION_FAILED`.
9. **Sonic health check (Deploy section, story 46).** The Sonic image is
   distroless (no shell, no `nc`), so it cannot have a Docker `healthcheck`.
   Readiness has to be checked from outside: the worker and server retry the
   connection, and `depends_on: condition: service_healthy` cannot be used for
   Sonic.
10. **Env list.** Add the database admin credentials (superuser needed for
    `Extensions.sql`), the MusicBrainz dump URLs for `sample` and `full`, the
    LRCLIB listing URL and dump URL, the Sonic tuning variables above, and
    `MBSLAVE_MUSICBRAINZ_TOKEN` (or `_FILE`). Note the wrong variable name in
    mbslave's README (`MBSLAVE_DB_DB` is the real one).
11. **The `sample` dataset is not small in Recordings** (2.95 M, 7.3% of the
    full catalog), so "run the full flow locally in a reasonable time and disk"
    holds (about 12 minutes and 5 GB on this laptop) but the Sonic index and
    search behaviour on `sample` are already big enough to show finding 1 and 2.
    It is also heavily skewed (Springsteen, Elvis, Beatles) and most of its
    Recordings are on no release, so Get by id fixtures should not assume a
    primary release exists.
12. **mbslave must be built from git**, pinned by tag and commit (PyPI is at
    28.0.0), into its own image published to GHCR by CI, with `psql` inside.

### Holds

13. Recording as the unit and MBID (`gid`) as identity, with
    `recording_gid_redirect` for merges (table present in dumps: 1.8 M rows in
    the sample, 5.08 M in the full dump).
14. Postgres holds MusicBrainz schemas plus ours: `postgres:17-alpine` works
    for `init`, `import` and the sample (needs `cube`, `earthdistance`,
    `unaccent`, ICU and a superuser for the bootstrap only).
15. Read-only Drizzle declarations for MusicBrainz tables without migrations
    (mbslave owns them).
16. Triggers feeding an outbox: mbslave applies each packet as ordinary DML in
    one transaction, so triggers fire and commit together with the packet; the
    initial import disables triggers, so installing them after the restore is
    right.
17. Testing seams: the e2e schema can come from mbslave's own SQL scripts (8
    scripts, 4.4 s, 375 tables through `psql`), a fake HTTP server works for
    both dump downloads and replication packets, and a real-mbslave bootstrap
    e2e is feasible with a Python image. Sonic in Testcontainers needs only
    environment variables.
18. Object key = MBID for Sonic (128 ASCII byte limit, 36 needed), and the
    collection with two buckets `metadata` and `lyrics`.
19. Strict Lyrics matching with a ±2 s window is implementable from LRCLIB's
    `tracks` table (`duration` in seconds, lowercased names, album), about 20%
    of a random sample of Recordings matched it.
20. Updating a Sonic document is `FLUSHO` plus `PUSH` (verified), and pushes
    that were acknowledged survive a killed Sonic process (verified, section 7).


## Appendix: reproduction

Everything below ran outside the repo. Commands are shortened to the parts that
matter.

### mbslave image (built and used for all mbslave results)

```dockerfile
# Spike image: mbslave pinned to a git tag (PyPI only has 28.0.0, MusicBrainz
# is on schema 31), plus psql because `mbslave init` shells out to it.
FROM python:3.13-slim
ARG MBSLAVE_REF=v31.0.1
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client git gcc libc6-dev libpq-dev dumb-init \
 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir "git+https://github.com/acoustid/mbslave.git@${MBSLAVE_REF}"
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["mbslave", "--help"]
```

### Restoring the sample (section 1)

```sh
docker run -d --name pg --network spike -e POSTGRES_PASSWORD=postgres \
  postgres:17-alpine -c shared_buffers=1GB -c maintenance_work_mem=1GB -c max_wal_size=8GB
export MBSLAVE_DB_HOST=pg MBSLAVE_DB_USER=musicbrainz MBSLAVE_DB_PASSWORD=musicbrainz \
       MBSLAVE_DB_ADMIN_USER=postgres MBSLAVE_DB_ADMIN_PASSWORD=postgres
curl -O https://data.metabrainz.org/pub/musicbrainz/data/sample/20260901-000002/mbdump-sample.tar.xz
mbslave init --create-user --create-database --empty
mbslave import mbdump-sample.tar.xz
```

### Per-table sizes without restoring (section 4)

A 40-line Python script streamed each archive from stdin
(`curl -sL <url> | python3 stream_sizes.py r|bz2 out.json`), and for every tar
member recorded its uncompressed size and newline count (one row per line in
`COPY` text format). Nothing was written to disk. The same script on the sample
archive was compared with the row counts after the restore.

### Sonic (section 7)

```sh
docker run -d --name sonic -p 1491:1491 \
  -e SONIC_CHANNEL__INET=0.0.0.0:1491 -e SONIC_CHANNEL__AUTH_PASSWORD=spike \
  -e SONIC_STORE__KV__PATH=/var/lib/sonic/store/kv/ \
  -e SONIC_STORE__FST__PATH=/var/lib/sonic/store/fst/ \
  -e SONIC_TOKENIZATION__DETECT_SPECIAL_PATTERNS=false \
  -e SONIC_NORMALIZATION__DIACRITIC_FOLDING_ENABLED=true \
  -e SONIC_STORE__KV__RETAIN_WORD_OBJECTS=1000000 \
  -v sonic-data:/var/lib/sonic/store valeriansaliou/sonic:v1.10.1
```

A Node script read `mbid<TAB>document` lines and pushed each document with
`PUSH mb metadata <mbid> "<text>"` over 8 parallel ingest connections.
Documents came from this query, run against the restored sample (one row per
Recording; 2,948,134 rows, 1.73 GB, 196 s):

```sql
-- One row per Recording: MBID + the text that goes to Sonic's metadata bucket.
SELECT r.gid::text AS mbid,
       regexp_replace(concat_ws(' ',
         r.name,
         NULLIF(r.comment, ''),
         ac.names,
         art.names,
         rel.titles,
         wk.titles,
         gn.names), '\s+', ' ', 'g') AS doc
  FROM musicbrainz.recording r
  LEFT JOIN LATERAL (
    SELECT string_agg(acn.name, ' ' ORDER BY acn.position) AS names
      FROM musicbrainz.artist_credit_name acn
     WHERE acn.artist_credit = r.artist_credit) ac ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(concat_ws(' ', a.name, a.sort_name, al.names), ' ') AS names
      FROM musicbrainz.artist_credit_name acn
      JOIN musicbrainz.artist a ON a.id = acn.artist
      LEFT JOIN LATERAL (
        SELECT string_agg(concat_ws(' ', aa.name, aa.sort_name), ' ') AS names
          FROM musicbrainz.artist_alias aa WHERE aa.artist = a.id) al ON true
     WHERE acn.artist_credit = r.artist_credit) art ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT rl.name, ' ') AS titles
      FROM musicbrainz.track t
      JOIN musicbrainz.medium m ON m.id = t.medium
      JOIN musicbrainz.release rl ON rl.id = m.release
     WHERE t.recording = r.id) rel ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT w.name, ' ') AS titles
      FROM musicbrainz.l_recording_work lrw
      JOIN musicbrainz.work w ON w.id = lrw.entity1
     WHERE lrw.entity0 = r.id) wk ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT g.name, ' ') AS names
      FROM musicbrainz.recording_tag rt
      JOIN musicbrainz.tag tg ON tg.id = rt.tag
      JOIN musicbrainz.genre g ON g.name = tg.name
     WHERE rt.recording = r.id) gn ON true
 ORDER BY r.id
```

The relevance harness picked Recordings at random (400 that are on a release;
300 with a title used at most 20 times by five artists with 9,652 to 65,683
Recordings each), built the query text from the title and the artist credit,
ran `QUERY mb metadata "<text>" LIMIT(100)` and recorded the rank of the
Recording's own MBID and the round-trip time.

### LRCLIB (section 5)

The dump header was read with two `Range` requests and
`zlib.decompressobj(31)`; the schema from the `sqlite_master` pages in the first
400 MB of the decompressed file; record sizes from 250 random
`GET /api/get/{id}` calls and the match rate from 200 `GET /api/search` calls
(sequential, 0.5 to 0.6 s apart, `User-Agent` identifying the project).
