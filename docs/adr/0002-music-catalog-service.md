# 2. Music catalog: a separate MusicBrainz + Meilisearch service over WebSocket

- Status: accepted
- Date: 2026-09-30

## Context

notefinder's catalog (Tracks, Artists, Albums) stops depending on YouTube
Music (ADR 0001) and needs its own source of every song in the world to
search and pick from. The data is open: MusicBrainz publishes its database
as dumps plus hourly replication packets, and LRCLIB publishes Lyrics as a
dump. The full design, the spike findings and the search benchmark are in
issue #55 and its comments, and in `docs/research/music-catalog-spike.md`.

## Decision

- **A separate, private service** (`apps/music-catalog`) runs on **its own
  server**, apart from the API.
  - It holds a Postgres restored from the MusicBrainz dumps and kept in sync by
    mbslave, plus Lyrics from LRCLIB and a search index.
  - It is started from a single production compose (`docker compose up -d`) and
    doesn't use Coolify, because its data (about 150-220 GB steady state in
    `full`) doesn't fit the API's stateless, multi-instance model.
- **The API talks to it over one long-lived, authenticated WebSocket.**
  - The protocol is private: a request/response envelope with correlation ids,
    and its own error codes, in `@notefinder/contracts`.
  - Auth is `Authorization: Bearer <key>` on the handshake, with a key list so
    keys can be rotated.
  - It is not part of the public OpenAPI.
- **The unit is the MusicBrainz Recording, never grouped.** A singer may want a
  specific take (e.g. one sung in another key), so a studio take, a live take
  and a remaster are separate results.
- **A Recording is identified by its MBID**, not MusicBrainz's integer id.
  - The integer row disappears on a merge, while `recording_gid_redirect` keeps
    old MBIDs resolvable.
  - A merged MBID answers `RECORDING_MOVED` with the new one, the same pattern
    as ADR 0001.
- **Search uses Meilisearch.** Results keep Meilisearch's relevance order when
  loaded from Postgres, with no re-ranking.
  - On the 2.95 M-Recording sample it reached 95.8% recall@10 on title and
    artist, and 91% on title only.
  - It handled typos and prefixes, with p95 latency of 22-97 ms.
  - Tuned Sonic, the first choice, got 84.8% and 49.8%, at an 815 ms p95.
  - The cost is disk: the full index is extrapolated at 79-149 GB.
- **Data licence:** notefinder is non-commercial.
  - It uses MetaBrainz's free non-commercial replication token.
  - Replication packets and the tags/genres dump are CC BY-NC-SA 3.0, so the web
    owes attribution where genres and tags are shown.
- **Sync goes through Postgres triggers into an outbox.** Triggers on the
  MusicBrainz tables feed an outbox that the worker drains into the index, so
  every change (including merges and deletes) survives restarts.
- **The service never goes back to not-ready after the first import.**
  - MusicBrainz's yearly schema change is handled by a CI PR that bumps mbslave.
  - An automatic **blue-green reimport** follows: a parallel copy and new
    indexes are built while the current copy serves, then swapped.

## Considered options

- **Sonic.** Rejected: with defaults, 33% of real queries returned nothing; tuned,
  it was slower and less accurate than Meilisearch.
- **Postgres full-text search.** It is cheaper on disk (about 27 GB for the full
  index), but was measured only in an idealized setup, with no typo or prefix
  matching.
- **Grouping Recordings into songs.** Rejected; see "unit" above.
- **A commercial MetaBrainz account, or CC0 data only.** Not needed while
  notefinder is non-commercial. CC0-only would have meant no replication and no
  genres.

## Consequences

- If notefinder becomes commercial, the MetaBrainz tier and the CC BY-NC-SA data
  (replication and genres) must be revisited first.
- The server needs about 150-220 GB of steady disk in `full`, plus about 260 GB
  temporary per LRCLIB import and about 2x during a blue-green reimport.
  Meilisearch latency depends on RAM.
- Local development and tests use the MusicBrainz sample, a generated fake
  LRCLIB dump and e2e fixtures, never the full data.
