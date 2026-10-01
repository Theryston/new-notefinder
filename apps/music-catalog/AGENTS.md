# apps/music-catalog: Music catalog service

Read the root `AGENTS.md` first; this file only adds this app's rules.

The **Music catalog** is a private, autonomous service that will hold every
**Recording** in the world (kept in sync with MusicBrainz, plus open
**Lyrics**), searchable in milliseconds. Internal clients (the API today,
others later) talk to it over one long-lived, authenticated **WebSocket**.
The full design is in the parent spec, issue #55; this file documents what
exists.

**What exists today**: the authenticated WebSocket server answering
`status`, `getRecording` and `search` (issues #57, #59 and #58), the protocol
envelope, our own Postgres schema (the bootstrap state, the indexing
checkpoint and the recording outbox), read-only declarations of the
MusicBrainz tables the queries read, **Meilisearch** as the search engine
behind a small integration, the `server` and `worker` entrypoints (the worker
indexes every Recording once the MusicBrainz data is restored, then keeps
the index in sync with it through the outbox), the **first import** (issue
#60: the mbslave container restores the MusicBrainz dump and records
`restoring`/`restored`) and the test and quality setup. Replication, Lyrics
and the production compose are later tickets: do not build them here ahead of
their ticket. `search` returns results in **Meilisearch's relevance order**,
loaded from Postgres without re-ranking.

Stack: Node/TypeScript **without Nest**, ESM, `ws`, Drizzle ORM + PostgreSQL
(`pg`), Meilisearch (its official JS client, behind `integrations/`), Zod
(protocol schemas come from `@notefinder/contracts`), Vitest, Testcontainers. Not a public API: it has no OpenAPI, no versioned URLs and no
users; only trusted services with an API key connect.

## Commands

```sh
nub run dev          # server + worker in watch mode (tsx watch), port from PORT (default 3334)
nub run build        # tsc -> dist/ (start:server / start:worker run the compiled entrypoints)
nub run test         # unit tests (*.spec.ts)
nub run test:cov     # unit tests + coverage thresholds (report in coverage/)
nub run test:e2e     # e2e tests (test/*.e2e-spec.ts) against a Testcontainers Postgres + Meilisearch
                     # (needs Docker, or E2E_DATABASE_URL and E2E_MEILISEARCH_URL, see Testing);
                     # report in coverage-e2e/
nub run test:mutation --filter=music-catalog   # Stryker
nub run check-types
nub run lint         # biome + dependency-cruiser
```

Local setup, from the repository root:

```sh
nub install
cp apps/music-catalog/.env.example apps/music-catalog/.env
(cd apps/music-catalog && nub run db:migrate)
nub run build --filter=music-catalog              # the mbslave container runs this dist
nub run infra:up                                   # this app's Postgres (5433) and Meilisearch (7700),
                                                   # plus a one-shot mbslave container that restores the
                                                   # sample dump, then the worker indexes it to `ready`
nub run dev --filter=music-catalog                 # ws://localhost:3334
```

Watch `status` while the sample restores (about a dozen minutes the first
time): `restoring` (mbslave) → `restored` → `indexing` (worker) → `ready`.
`CATALOG_DATASET=full` restores everything instead (see "Dataset modes");
switching datasets means resetting the database (see "Resetting a local
database").

Database scripts (`db:generate` needs no `.env`; `db:migrate` needs a valid
one, since it reads the same env schema):

```sh
nub run db:generate  # drizzle-kit: schema diff -> new SQL migration in drizzle/
nub run db:migrate   # apply migrations; an explicit step, never run on boot
```

## Folder structure

```
src/
  server.ts               entrypoint of the server process: env, pool, server, signals
  worker.ts               entrypoint of the worker process: env, pool, worker, signals
  restore.ts              entrypoint of the mbslave container: env, pool, restore, exit code
  create-server.ts        composition roots of both processes: the server (modules -> handlers ->
                          ws server) and the worker (services -> `tick`)
  config/env.ts           Zod schemas for process.env: shared, server, worker and restore sets
  logger.ts               minimal structured logger (JSON in production)
  errors/                 CatalogError: an expected failure with a protocol error code
  lib/                    small pure helpers shared by modules (text comparison, cover art URL,
                          grouping) and the definition of the recordings index
  integrations/
    meilisearch/          MeilisearchIndex: the only code that imports the Meilisearch SDK
    mbslave/              MbslaveClient: the only code that spawns the mbslave binary
  database/
    database.ts           pg pool + Drizzle client
    schema/               one file per table (music-catalog-schema.ts holds the pgSchema)
    schema/musicbrainz/   read-only declarations of mbslave's tables, one file per entity
    migrate.ts            script behind db:migrate
  ws/                     protocol plumbing, knows nothing about features
    ws-server.ts          http + ws server: handshake auth, heartbeat, message loop
    api-keys.ts           constant-time API key check
    handshake.ts          the raw HTTP 401 answer of a refused handshake
    envelope.ts           parse requests, build responses, map errors
    handler.ts            defineHandler(): a request type tied to its contract schemas
    dispatcher.ts         text frame -> handler -> response, with the request timeout
    heartbeat.ts          ping/pong liveness
  modules/                one folder per feature
    bootstrap/
      bootstrap.handler.ts      the `status` handler
      bootstrap.service.ts
      bootstrap.repository.ts
      bootstrap.service.spec.ts
      restore.service.ts        the first import mbslave owns: skip, redo or restore
      restore-plan.ts           which of those a start has to do (pure)
      dump-urls.ts              the dump archives under the base URL (pure + LATEST)
    recording/
      recording.handler.ts      the `getRecording` handler
      recording.service.ts      readiness, not found / moved, loading the parts
      recording.repository.ts   the queries on the MusicBrainz tables
      recording-data.ts         the rows the repository returns
      assemble-recording.ts     rows -> the protocol's Recording (pure)
      genre-fallback.ts         which level the genres and tags come from (pure)
      release-event.ts          the date and country a release is shown with (pure)
      recording-summary.*       the summaries a search lists (one query), for the search module
      assemble-summary.ts       summary row -> the protocol's RecordingSummary (pure)
      recording-document.*      the documents of a batch of Recordings, for the indexing module
      recording-document.ts     rows -> the document Meilisearch indexes (pure)
    search/
      search.handler.ts         the `search` handler
      search.service.ts         readiness, scope, Meilisearch, summaries, order
      order-by-ids.ts           rows -> the order of a list of ids, dropping the missing (pure)
    indexing/
      indexing.service.ts       the worker's initial indexing: batches, checkpoint, ready
      indexing.repository.ts    the indexing checkpoint
    sync/
      sync.service.ts             the worker's continuous sync: triggers, outbox drain
      sync-plan.ts                outbox entries + current rows -> index writes (pure)
      sync-tracked-tables.ts      which MusicBrainz tables have a trigger, and the SQL builder
      recording-outbox.repository.ts  pending entries, done marks, trigger installer
      sync.*.spec.ts              unit tests of the plan, the service and the tracked set
  worker/worker-loop.ts   the loop the worker's steps plug into
mbslave.Dockerfile        the mbslave image: Node for dist/restore.js plus mbslave from
                          git (pinned) and psql; run by the dev compose (below)
docker-compose.yml        our Postgres (5433), Meilisearch (7700) with its key-creating
                          job, and the one-shot mbslave service owning the restore
drizzle/                  generated SQL migrations (committed)
test/                     e2e specs + helpers (test server, ws client, Testcontainers setup,
                          MusicBrainz schema and fixture)
```

- A feature module owns its handler(s), service, repository and tests. Other
  modules use it only through its **service**.
- `ws/` is generic protocol code. A feature plugs in a handler; `ws/` never
  imports `modules/`.
- Third-party clients (Meilisearch today, HTTP downloaders later) live in
  `integrations/`, wrapped behind a small typed class, one folder each.
  **Nothing else imports the SDK**: features depend on the wrapper
  (`MeilisearchIndex`), which is also what unit tests stand in for, and the
  composition roots build it with `createMeilisearchIndex`.

## Layers (handler -> service -> repository)

- **Handler** (`*.handler.ts`): the WebSocket counterpart of a controller. It
  is built with `defineHandler({ type, payload, result, run })` from `ws/`,
  using the payload and result schemas from `@notefinder/contracts`, and
  calls one service method. No business rules, no Drizzle. `defineHandler`
  validates the payload (`VALIDATION_FAILED`) and parses the result with the
  contract schema, so no extra field ever leaks to a client.
- **Service**: business rules and orchestration (repositories, integrations).
  Throws `CatalogError(code, message)` for expected failures. No Drizzle.
- **Repository**: the only layer that imports Drizzle and the schema. Returns
  plain typed objects. One repository per aggregate, `<Feature>Repository`.
- Wiring is manual, in `create-server.ts` (no DI framework): build
  repositories, then services, then handlers, and pass the handlers to
  `createWsServer`; `createMusicCatalogWorker`, in the same file, builds the
  worker's services and returns its `tick`. A new module adds its lines there.
  (The file holds both roots because it is one of the files the unit
  coverage and mutation configs leave to the e2e suite, which runs both.)
- `nub run lint` runs dependency-cruiser (`.dependency-cruiser.cjs`), which
  enforces this: no cycles, only repositories (and `src/database/`) touch
  Drizzle, handlers never import repositories, services and repositories
  never import handlers or `ws/`, `ws/` never imports modules.
- dependency-cruiser enforces that only `src/integrations/` imports the
  Meilisearch SDK.

## ESM details

- `"type": "module"` + `nodenext`: relative imports **must** end in `.js`
  (`import { BootstrapService } from './bootstrap.service.js'`).
- Top-level `await` is fine (see `server.ts`). No `require`, no `__dirname`
  (use `import.meta.dirname` / `new URL(..., import.meta.url)`).
- `tsx` runs the TypeScript in dev and for `db:migrate`; production runs the
  output of `tsc` (`dist/`).

## Protocol (`@notefinder/contracts`, `music-catalog.ts`, `music-catalog-recording.ts` and `music-catalog-search.ts`)

The schemas and types live in contracts and are the only definition of the
protocol; never redeclare them here. They are **private**: not part of the
API's OpenAPI document, and the error codes are their own enum
(`musicCatalogErrorCodeSchema`), not `ApiErrorCode`.

Connection: `ws://host:PORT` (`wss://` behind Caddy in production). The
handshake must carry `Authorization: Bearer <key>`, where `<key>` is any of
the comma-separated `API_KEYS`. Each key is compared in constant time (all of
them, always). A missing or wrong key is refused **before** the upgrade with
**HTTP 401**, `WWW-Authenticate: Bearer` and a JSON body `{ code:
'UNAUTHORIZED', message }`. A plain HTTP request that is not an upgrade gets
426.

Messages are JSON **text** frames (a binary frame is answered
`VALIDATION_FAILED`), at most 64 KiB (a bigger one closes that connection with
code 1009).

```
request   { id, type, payload }
success   { id, ok: true,  result }
failure   { id, ok: false, error: { code, message, newMbid? } }
```

- `id` is chosen by the client (1 to 128 characters) and echoed by the
  response that answers it. Every message is handled on its own, so many
  requests can be in flight on one connection and responses may arrive in any
  order: match them by `id`. `id` is `null` in a failure only when the
  message was too broken to read one from it.
- `type` is `status`, `getRecording` or `search`. `payload` is validated per
  type; `status` takes none (missing or `{}`).
- `status` result: `{ phase: 'restoring' | 'restored' | 'indexing' | 'ready',
  dataset: 'sample' | 'full' }`, read from the bootstrap state row in our
  schema. The phases run in that order: the mbslave container records
  `restoring` and `restored` (it owns the MusicBrainz restore), then the
  worker waits for `restored` and records `indexing` and `ready`. While no row
  has been written, the answer is `restoring` with the configured
  `CATALOG_DATASET`.
- Error `code`s: `UNAUTHORIZED` (handshake only), `VALIDATION_FAILED`
  (malformed message or payload, binary frame), `UNKNOWN_REQUEST_TYPE`,
  `CATALOG_NOT_READY`, `RECORDING_NOT_FOUND`, `RECORDING_MOVED`, `INTERNAL`.
  `message` is an English developer message. `RECORDING_MOVED` also carries
  `error.newMbid` (the only error with an extra field): a `CatalogError`
  built with `{ newMbid }` becomes it. Anything a handler throws that is not
  a `CatalogError` is answered `INTERNAL` with the fixed message "Internal
  error" and logged; its own message never reaches the client.
- A malformed message or an unknown type never closes the connection.
- **Heartbeat**: the server pings every `HEARTBEAT_INTERVAL_MS`; a connection
  that did not pong since the previous ping is terminated (so a dead peer is
  dropped within two intervals). Clients need no code for it: WebSocket
  libraries answer pings by themselves. Clients should reconnect when a
  connection drops (the server also closes with 1001 when it shuts down).
- **Request timeout**: a request still unanswered after `REQUEST_TIMEOUT_MS`
  gets `INTERNAL` ("Request timed out"). The handler keeps running (a promise
  can't be cancelled), so handlers must be safe to finish late.
- Every operation that reads the catalog (`getRecording`, `search`)
  starts with `BootstrapService.assertReady()`: until the first import
  reaches `ready` it answers `CATALOG_NOT_READY` (after the payload is
  validated), and it reads the phase on every request, so it follows the
  worker. `status` is the only operation that answers meanwhile.
- Changing a field of a result is a breaking change for consumers: add
  fields, don't rename or remove them (same rule as the API's contracts).
  A new operation adds its type to `musicCatalogRequestTypeSchema` and its
  payload/result schemas to contracts, a handler in its module and a line in
  `create-server.ts`.

## `getRecording`

Payload `{ mbid }` (any UUID-shaped text; a malformed one is
`VALIDATION_FAILED`, the case does not matter). The result is the contract's
`Recording` (`music-catalog-recording.ts`): every field is always present,
null or empty when unknown, never omitted. Only the MBID is the identity: the
integer ids of MusicBrainz are internal and never leave the service.

- `RECORDING_NOT_FOUND`: the MBID is unknown (or the Recording it was merged
  into was deleted). `RECORDING_MOVED` + `error.newMbid`: the MBID is in
  `recording_gid_redirect` and its target exists.
- Core: `mbid`, `title`, `lengthMs` (null when unknown), `disambiguation`
  (`''` when none), `video`, `isrcs` (sorted), and `artistCredit`: the whole
  credit as printed plus, per artist in credit order, `mbid`, `name` (the
  artist's own), `creditedName` (as this Recording credits it) and
  `joinPhrase`.
- `releases`: one entry per track the Recording is on, each with the release
  and release group MBIDs, title, release group primary type, status,
  `mediumPosition` and `trackPosition`, and `coverArtUrl`. Its `date` and
  `country` (ISO 3166-1 alpha-2) are the release's **earliest release event**
  (dates keep their precision: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`; a dated
  event beats an undated one; ties go to the smaller country code). Releases
  come oldest first, undated last, then by title and MBID.
- `coverArtUrl` is `https://coverartarchive.org/release/<release MBID>/front-500`,
  built from the MBID alone (`cover_art` is not loaded in `sample`), so it can
  answer 404. `src/lib/cover-art-url.ts` is the one place that builds it; the
  search ticket reuses it.
- `works` (Recording-Work relationships), `externalUrls` (`url` plus
  `linkType`, MusicBrainz's name for the relationship, e.g. "streaming music").
- **Genres and tags** (`genres`, `tags`, `tagsSource`): genres are the tags
  MusicBrainz also lists as genres (matched by name, with the genre MBID);
  the rest are tags; both carry the vote count and come most voted first, by
  name on a tie. Only tags with a positive vote count. The fallback is on
  **genres**, and `tagsSource` names the one level both lists come from
  (levels are never mixed):
  1. `source` is the first level with at least one genre, in this order: the
     **Recording's own**, the **release groups'** of the releases it is on
     (votes added up per tag), its **credited artists'** (added up likewise).
     `genres` are that level's genres and `tags` its other tags. So a
     Recording tagged only "live" whose release group has a genre gets the
     release group's genres and other tags, and its own "live" is not in the
     answer.
  2. When no level has a genre, `source` is the first level with any tag:
     `genres` is empty and `tags` are that level's (a Recording tagged only
     "live", with no genre anywhere, keeps it, `tagsSource: 'recording'`).
  3. When no level has any tag, `tagsSource` is null and both lists are empty.

  The rule is in `genre-fallback.ts`.
- `lyrics` is `{ plain: null, synced: null }` until the Lyrics ticket fills it.
- Loading: the service reads the parts in parallel (one query each, all in
  `RecordingRepository`) and `assembleRecording` builds the answer without
  any I/O; the rules above live in those pure functions.

## `search`

Payload `{ query, scope?, limit?, offset? }`:

- `query`: text, trimmed, 1 to 256 characters (`SEARCH_MAX_QUERY_LENGTH`).
  Anything else, blanks included, is `VALIDATION_FAILED`.
- `scope`: `metadata` (default) or `lyrics`. `lyrics` is accepted by the
  schema but answers `{ results: [] }` until Lyrics are imported (issue #63).
- `limit`: 1 to 100, default 20. `offset`: 0 to 900, default 0. A client can
  reach the first 1000 matches of a query (Meilisearch's
  `pagination.maxTotalHits`, which the index settings pin to
  `SEARCH_MAX_TOTAL_HITS`); the bounds live in contracts and derive from it.

Result `{ results: RecordingSummary[] }` (an object, so fields can be added
later), best match first:

- `mbid`, `title`, `lengthMs`, `disambiguation`, `video`, `artistCredit`
  and `genres` are the Recording's own (the schema is `getRecording`'s
  `recordingSchema` picked, so the names and meaning cannot drift), and
  `primaryRelease` is `{ mbid, title, year, coverArtUrl }` or null.
- `primaryRelease` is the release `getRecording` lists first (the oldest by
  earliest release event, undated last, then by title and MBID); `year` is
  the year of that event, null when unknown. `genres` follow the same
  fallback as `getRecording` (the Recording's, else its release groups', else
  its artists'; never mixed).
- **The order is Meilisearch's, untouched**: the server asks Meilisearch for
  the MBIDs only (`attributesToRetrieve` is the primary key), reads every
  summary of the page from Postgres in **one query**
  (`RecordingSummaryRepository`, one statement with a lateral subquery per
  part) and puts the rows back in the order of the MBIDs (`orderByIds`).
  An MBID Meilisearch returns that is no longer in the database is dropped,
  so a page can be shorter than `limit` without being the last one: stop
  paging on an empty page.
- Before `ready` it answers `CATALOG_NOT_READY` (after validating).
  Meilisearch being down is `INTERNAL`.

## First import

The mbslave container owns the restore (issue #60): the Node image has no
Python or `psql`, so the server and the worker never run it. On start the
container runs `dist/restore.js` (`src/restore.ts`, built on the host with
`nub run build --filter=music-catalog` and mounted read-only), which checks
the bootstrap state and either exits or restores:

- **No row yet** (`fresh`): records `restoring`, reads the dataset's `LATEST`
  file under `MUSICBRAINZ_DUMP_BASE_URL`, restores the archives with `mbslave
  init --empty` followed by `mbslave import <urls>` (plain `init` is neither
  idempotent nor URL-configurable), and records `restored`. A failure leaves
  `restoring` behind, so the next start redoes it; `ready` is the worker's to
  record, never the restore's.
- **Restore done** (`skip`): the phase is `restored`, `indexing` or `ready`
  with the configured dataset. It downloads and restores nothing.
- **Interrupted restore** (`redo`): the phase is still `restoring`. It drops
  every schema mbslave creates and starts over from a clean state (`import`
  skips tables that already hold rows, so a resume would silently keep a
  half-loaded dump).
- **Another dataset** (`dataset-changed`): the catalog reached `restored` or
  further with a different `CATALOG_DATASET`. It refuses instead of silently
  re-downloading gigabytes: reset the database (below) and start over.

`status` shows each phase (`restoring` → `restored` → `indexing` → `ready`);
`search` and `getRecording` answer `CATALOG_NOT_READY` until `ready`.
Greppable restore logs (`docker compose logs -f music-catalog-mbslave`):
`Restoring the MusicBrainz dump` (with `latest`, `archives`, `urls`),
`Restore schema creation finished` / `Restore import finished` (with
`durationMs`), `Restore already done, skipping the download` on skip and
`Restore failed, the next start redoes it` on failure. The pre-import log
also carries `totalBytes` (summed `HEAD` `Content-Length`, omitted when a
size is missing). The worker logs `Indexed a batch of Recordings` with
`indexed`, `total` and `percent` per batch against one `count(*)` per run.

Handoff for issue #61 (change triggers and the outbox, owned by that ticket):
after this records `restored`, the worker installs the change triggers and
only then indexes. Nothing trigger- or outbox-shaped is created here, and a
redo never drops the outbox's schema: it does not exist yet.

## Dataset modes

`CATALOG_DATASET` is `sample` or `full`, required with no default, and the
first import records it in the bootstrap state. Both go through the same
`import <urls>` code path; only the archives differ
(`src/modules/bootstrap/dump-urls.ts`):

- `sample`: the official sample dump, one `mbdump-sample.tar.xz` under
  `<base>/sample/`. Development mode: about 6 GB and a dozen minutes. The
  sample ships no `cover_art` data and an empty `replication_control`, so
  there is no cover-art data and no replication in this mode.
- `full`: core plus derived (`mbdump.tar.bz2` + `mbdump-derived.tar.bz2`
  under `<base>/fullexport/`), no edit history. Production mode: about
  150-220 GB steady state (see ADR 0002).

`MUSICBRAINZ_DUMP_BASE_URL` is the `.../data` directory both layouts live
under (default: the official `data.metabrainz.org` directory). The mbslave
binary reads its own `MBSLAVE_*` variables from the container environment
(use `MBSLAVE_DB_DB` for the database name; mbslave ignores the README's
`MBSLAVE_DB_NAME`); the dump download needs no token. The image
(`mbslave.Dockerfile`) installs mbslave from git tag `v31.0.1`: bump
`MBSLAVE_REF` there together with `MBSLAVE_REF` in
`test/setup/musicbrainz-schema.ts`, which builds the same schema in e2e.

## Resetting a local database

Switching datasets, or throwing away a local import, means starting over;
there is no in-place switch:

```sh
# From the repository root: drops the dev Postgres data (and the downloaded
# dumps), so the next `infra:up` restores the configured dataset from scratch.
docker compose down -v
nub run infra:up
```

Dropping only the volume works too
(`docker volume rm notefinder_music-catalog-postgres-data`), but `-v` drops
every dev volume (the API's database included). Never run either against a
database that holds anything worth keeping.

## Meilisearch

The search engine (chosen after the benchmark in issue #68). Its URL and keys
come from env; version pinned to a stable v1.x in the dev compose
(`getmeili/meilisearch:v1.54.2`) and in e2e.

- **`recordings` index**, primary key `mbid` (the Recording's MBID). One
  document per Recording (`RecordingDocument`, `src/lib/recordings-index.ts`),
  built by `buildRecordingDocument` from: `title`, `artistCredit` (the credit
  as printed), `artistAliases` (name and sort name of each credited artist and
  of each of its aliases), `releaseTitles`, `workTitles`, `genres` (names, from
  the level `getRecording` takes its genres from) and `disambiguation`. The
  lists hold each text once, sorted, so re-indexing a Recording sends the same
  document. Nothing to display lives in the index: results come from Postgres.
- **Settings**, applied by code (`MeilisearchIndex.ensure`, idempotent: it
  reads the index and only writes what differs, so a restart never makes
  Meilisearch reindex): `searchableAttributes` in ranking order (`title`,
  `artistCredit`, `artistAliases`, `releaseTitles`, `workTitles`, `genres`,
  `disambiguation`) and `pagination.maxTotalHits`. **Typo tolerance, prefix
  search and every other setting stay at Meilisearch's defaults** (the
  benchmark's recall came from them; do not tune them here), so a typo in a
  word of 5 letters or more, or a last word cut short while typing, still
  finds the Recording.
- **Indexing flow** (`IndexingService.run`, one worker tick): while the phase
  is `restoring` or there is no bootstrap row, nothing happens. On `restored`
  the worker records `indexing`, applies the settings, and walks the
  Recordings by MusicBrainz's integer id, `INDEXING_BATCH_SIZE` at a time
  (default 2000): read the batch's documents (one query per kind of data per
  batch, not per Recording), send them, **wait for the Meilisearch task**, then
  write the checkpoint (`music_catalog.indexing_checkpoint`, one row per
  index). When no Recording is left it records `ready`. A worker that dies or
  is restarted in the middle resumes after the checkpoint (a batch that was
  sent but not checkpointed is sent again, which replaces the same documents);
  a task that fails throws, the loop logs it and the next tick resumes. Aborting
  the worker's signal stops it after the batch in progress. Every tick drains
  the outbox first (a no-op until `ready`), then runs the initial indexing
  (a no-op once `ready`).

## Sync (outbox)

After the first import, every change to the MusicBrainz tables reaches the
`recordings` index through the outbox, while the service stays live:

- **Triggers** (`sync-tracked-tables.ts`): one `notefinder_sync_<table>`
  trigger per tracked table writes the affected Recording ids (with the MBID
  each had then) to `music_catalog.recording_outbox`. Both the `NEW` and the
  `OLD` row are enqueued, so deletes and moved links are caught; re-enqueueing
  re-arms the entry. This ticket owns the triggers: the worker installs (or
  replaces) them with plain SQL (`RecordingOutboxRepository.ensureTriggers`,
  idempotent, stale sync triggers dropped), after the restore and before
  indexing, and again on every tick while any is missing — never a Drizzle
  migration, since the tables belong to mbslave.
- **Drain** (`SyncService.drain`, one worker tick): only once `ready` (so a
  ready catalog never answers `CATALOG_NOT_READY`, however many entries wait).
  Each batch rebuilds the documents of the Recordings its entries touch with
  the same queries as the initial indexing (`RecordingDocumentService`,
  extended with `findDocumentsByIds`), upserts them, deletes the enqueued
  MBIDs that are gone (deleted rows) or stale (merges, MBID changes), and only
  then marks the entries done (`processed_at`, matched by key and only while
  still pending, so a change written mid-batch waits for the next one). A
  worker that dies mid-batch reprocesses what is left on its return; every
  write is idempotent, so processing an entry twice changes nothing.
- **Tracked tables** (the full list lives in `TRACKED_TABLES` and its spec):
  `recording`, `recording_gid_redirect`, `recording_tag`, `artist_credit`,
  `artist_credit_name`, `artist`, `artist_alias`, `artist_tag`, `release`,
  `medium`, `track`, `release_country`, `release_unknown_country`,
  `release_group_tag`, `work`, `l_recording_work`, `url`, `link`,
  `l_recording_url`, `link_type`, `tag`, `genre`. Only tables whose columns
  feed the indexed document are tracked: what `getRecording` shows live
  (isrcs, release dates and countries, release group names, link type names)
  needs no trigger, and search summaries are read from Postgres at query time.

  To track another table, add one entry to `TRACKED_TABLES`: the MusicBrainz
  table plus a `selectNew` query that returns `recording_id` and
  `recording_mbid` for the changed row (`NEW`; the `OLD` side is derived for
  deletes and moved links). Add the table to the e2e fixture's
  `FIXTURE_TABLES` only when a fixture helper writes to it, extend
  `test/recording-sync.e2e-spec.ts` with a scenario that changes the table
  and asserts over the WebSocket, and extend the tracked-set spec's table
  list.
- **Keys**: Meilisearch runs with a master key that neither process gets. The
  **server** has a search-only key (`MEILISEARCH_SEARCH_API_KEY`, action
  `search` on `recordings` and `lyrics`); the **worker** has a key that can
  write (`MEILISEARCH_WRITE_API_KEY`, actions `documents.*`, `indexes.*`,
  `settings.*` and `tasks.get`). Each process validates only its own
  variables (`parseServerEnv`, `parseWorkerEnv`). A key is derived from its
  `uid` and the master key (HMAC-SHA256), so a key created with a fixed `uid`
  is the same everywhere: the dev compose's `music-catalog-meilisearch-init`
  job creates both with fixed uids and `.env.example` lists the resulting
  values for the dev master key. In production create them once with the
  master key, for example:

  ```sh
  curl -X POST "$MEILISEARCH_URL/keys" -H "Authorization: Bearer $MEILI_MASTER_KEY" \
    -H 'Content-Type: application/json' \
    -d '{"name":"music-catalog-search","actions":["search"],"indexes":["recordings","lyrics"],"expiresAt":null}'
  ```

  and copy the `key` of each answer (the write one has the actions above and
  `"indexes":["*"]`, since a blue-green reimport builds indexes under other
  names).

## Database (Drizzle + Postgres)

- Our own tables live in the dedicated Postgres schema **`music_catalog`**
  (`src/database/schema/music-catalog-schema.ts`), managed by drizzle-kit
  migrations in `drizzle/` (committed; the migrations table is drizzle's
  default `drizzle.__drizzle_migrations`). The MusicBrainz tables belong to
  mbslave, which restores them into the `musicbrainz` schema of the same
  database: they are declared by hand as read-only Drizzle tables in
  `src/database/schema/musicbrainz/` (one file per entity: recording, artist,
  release, work, url, tag) and **never migrated here** (the folder is outside
  `drizzle.config.ts`'s `*.ts` glob and `schemaFilter` keeps drizzle-kit out
  of the schema). Declare a table or column when a query needs it, with the
  name and type of mbslave's `CreateTables.sql` at the pinned tag; only
  repositories import them, and a repository never writes to them. The files
  sit under `src/database/schema/`, so the coverage and mutation exclusions
  of the schema apply.
- Tables and columns are **snake_case** in SQL (`casing: 'snake_case'`),
  camelCase in TypeScript. Tables arrive with the feature that uses them.
- `bootstrap_state` is a single-row table (a boolean primary key that must be
  true): `phase`, `dataset` and timestamps. The mbslave container (Python)
  creates the row and writes `restoring` and `restored`; the worker writes
  `indexing` and `ready`. The enum values come from the contracts'
  `BOOTSTRAP_PHASES` / `CATALOG_DATASETS` constants, passed to Drizzle as
  tuples (not Zod's `.enum` object, from which drizzle-kit drops the Postgres
  schema of the type), so the database and the `status` result can't drift
  apart.
- `indexing_checkpoint` has one row per search index (`index_uid`, the last
  Recording sent to it by integer id, `updated_at`); the worker writes it
  after every confirmed batch. No row means nothing was indexed yet.
- Migrations: change the schema -> `db:generate` -> review the SQL -> commit
  it. Never edit an applied migration. CI runs `drizzle-kit check` +
  `generate` and fails when the schema has a change with no migration.
  Migrations are applied by `db:migrate` (a deploy step), never on boot.
- The server only reads. The schema is a file per table (no `schema/index.ts`
  barrel); `drizzle.config.ts` globs `src/database/schema/*.ts`.
- No barrel files; a table's file exports its table and enums.

## Config, logging, lifecycle

- Read config only from `src/config/env.ts` (Zod, parsed once at boot, fails
  fast with every problem listed); `apps/music-catalog/.env` is loaded
  automatically outside test/production. Every variable is in `.env.example`.

  | Variable | Meaning |
  | --- | --- |
  | `PORT` | Server port (default 3334; 0 picks a free one, used by tests) |
  | `DATABASE_URL` | The service's own Postgres (dev compose: port 5433) |
  | `API_KEYS` | Comma-separated keys, each at least 32 characters; list the new key next to the old one to rotate |
  | `CATALOG_DATASET` | `sample` or `full`; required, no default |
  | `HEARTBEAT_INTERVAL_MS` | Ping interval (default 30000) |
  | `REQUEST_TIMEOUT_MS` | Per-request timeout (default 10000) |
  | `MEILISEARCH_URL` | Meilisearch, `http(s)://` (dev compose: port 7700); server and worker |
  | `MEILISEARCH_SEARCH_API_KEY` | Search-only key; required by the **server** only |
  | `MEILISEARCH_WRITE_API_KEY` | Key that can write; required by the **worker** only |
  | `INDEXING_BATCH_SIZE` | Recordings per Meilisearch task while indexing (default 2000, 1 to 10000); worker |
  | `MUSICBRAINZ_DUMP_BASE_URL` | The `.../data` directory the dumps are published under (default: the official one); restore (see "First import") |

  The server and the worker parse different sets (`loadServerEnv`,
  `loadWorkerEnv`) on top of the shared one, so each fails fast on what it
  needs and never receives the other's key. The restore parses its own set
  (`loadRestoreEnv`): the shared `DATABASE_URL` and `CATALOG_DATASET` plus
  `MUSICBRAINZ_DUMP_BASE_URL`. `loadEnv` (the shared set) is what `db:migrate`
  reads, so a deploy step needs no Meilisearch settings.

- Logging: `createLogger` from `src/logger.ts` (one JSON object per line in
  production, text otherwise). No `console.*`. Never log API keys, the
  `Authorization` header or whole request bodies.
- Shutdown: on SIGINT/SIGTERM the server closes every connection with 1001,
  stops listening and closes the pool; the worker stops indexing after the
  batch in progress, finishes its tick and exits. Keep both stateless so
  several instances can run the server (run **one** worker: two would index
  the same batches twice, which is harmless but wasted work).

## Testing

- **Primary seam: the WebSocket protocol.** E2E specs (`test/*.e2e-spec.ts`)
  start the real server (`createMusicCatalogServer`, the same wiring as
  `server.ts`) on a free port against a real Postgres, and talk to it with a
  real `ws` client (`test/utils/ws-client.ts`). Assert what a client sees, not
  internals. Use `useTestServer(env?)` (one server per file) and
  `useTestClient(server)` (empties the database, connects and hangs up per
  test). Arrange the state the import will write (mbslave and the worker)
  with the helpers in `test/utils/database.ts` (`setBootstrapState`).
- Database: one Postgres 17 container per run (Testcontainers), migrated with
  the real migrations. Without Docker, set `E2E_DATABASE_URL` to a Postgres
  **dedicated to tests**: it is migrated and every table of the
  `music_catalog` schema is truncated. Files run sequentially against one
  shared database (`fileParallelism: false`).
- **Meilisearch in e2e** (`test/setup/meilisearch.ts`): one container per run
  (`getmeili/meilisearch:v1.54.2`, the tag of the dev compose; Testcontainers'
  generic container, there is no module for it), started next to Postgres by
  the global setup. It creates the two scoped keys (search, write) with the
  master key, and the test server and worker get only their own, so a missing
  permission fails a spec. Without Docker, set `E2E_MEILISEARCH_URL` and
  `E2E_MEILISEARCH_MASTER_KEY` to a Meilisearch **dedicated to tests** (its
  `recordings` index is deleted between tests). Helpers in
  `test/utils/test-worker.ts`: `createTestWorker(server, { env, signal })`
  builds a worker with the same wiring as `worker.ts` (build a new one to
  play a restart), `indexCatalog(server, worker?)` records `restored` and
  ticks it until the catalog is `ready`, `useEmptySearchIndex()` deletes the
  index before each test, and `meilisearchOrder(query)` asks Meilisearch
  itself what the order is, to compare a `search` answer with.
- **The MusicBrainz schema in e2e** (`test/setup/musicbrainz-schema.ts`):
  after the migrations, the global setup creates the real 375-table schema in
  the `musicbrainz` schema with the same eight SQL scripts `mbslave init
  --empty` runs (mbslave pinned to git tag `v31.0.1`, constant `MBSLAVE_REF`;
  bump it together with the mbslave container). The scripts come from
  musicbrainz-server (GPL), so they are **not vendored**: they are fetched
  from that tag on GitHub (with retries) and cached in
  `apps/music-catalog/node_modules/.cache/mbslave-<MBSLAVE_REF>/`, so the
  first run needs the network. CI's `e2e` job restores that folder with
  `actions/cache`, keyed on the `MBSLAVE_REF` it reads from
  `test/setup/musicbrainz-schema.ts`, so it hits GitHub only on the first run
  after a bump (bumping the constant is the only thing that changes the key).
  A script missing from a restored cache is still downloaded. They are run
  through `pg` with mbslave's `musicbrainz, public` search path and the psql
  `\set` lines stripped, no `psql` needed. The database user must be a
  superuser (contrib extensions `cube`, `earthdistance`, `unaccent`); the
  Testcontainers one is. A reused `E2E_DATABASE_URL` that already has the
  schema is left as is. Right after the schema, the global setup installs the
  worker's change triggers (`test/setup/sync-triggers.ts`, the same SQL the
  worker installs), so fixture writes reach the outbox the way replication
  packets will; it runs on every setup, since the SQL is idempotent.
- **The MusicBrainz fixture** (`test/utils/musicbrainz.ts` and
  `musicbrainz-relations.ts`): small helpers that write rows with plain SQL,
  the way a dump or a replication packet would (`addArtist`, `addRecording`,
  `addRecordingRedirect`, `deleteRecording`, `renameRecording`,
  `renameArtist`, `addIsrc`, `addRelease`, `renameRelease`, `addTrack`,
  `addWork`, `addExternalUrl`, `addGenre`, `addTag`,
  `addArtistAlias`, `mbid(n)`
  for readable MBIDs), deliberately **not** through the service's own Drizzle
  declarations, so a wrong column name there fails a spec. `resetDatabase`
  (run by `useTestClient`) also empties every table the fixture writes to, so
  a new helper that writes to another table must add it to `FIXTURE_TABLES`.
  Search and sync tests build on these; add a helper instead of writing SQL
  in a spec. `useReadyCatalog(server)` marks the import `ready` before each
  test (call it after `useTestClient`), and `requestRecording` and
  `requestSearch` send `getRecording` and `search` and parse the answer with
  the contract's schema. A search test arranges its Recordings, calls
  `indexCatalog`, then asks over the WebSocket. A sync test
  (`test/recording-sync.e2e-spec.ts`) arranges, calls `indexCatalog`, changes
  the MusicBrainz tables, ticks a worker and asserts over the WebSocket with
  bounded polling — never on the outbox rows.
- **The first import in e2e** (`test/first-import.e2e-spec.ts`): the real
  `RestoreService` wired like `restore.ts`, with mbslave behind its
  integration boundary (a fake `MbslaveRun`: `init` recreates the schema with
  `applyMusicBrainzSchema`, `import` downloads the archives over real HTTP
  and seeds what the dump would load) and the dump base URL pointed at a fake
  HTTP server (`test/utils/fake-dump-server.ts`, the real `sample` next to
  `fullexport` layout with tiny archives). It covers the first run to
  `ready` (restore, then a worker tick, then a search over the WebSocket),
  the skip on a second start, the redo from a clean state after an
  interrupted restore (it drops the real `musicbrainz` schema, so it
  re-applies it in a `finally` for the files after it) and the refusal to
  switch datasets. Spawning the real binary is deliberately out: it would
  need its Python/psql image, minutes per run and the network on every PR
  (the spike verified the real commands against a fake mirror instead).
- Unit (`*.spec.ts` next to the file): pure logic only (env parsing, API key
  check, envelope parsing and error mapping, handlers and their payload
  validation, the dispatcher with its timeout, the heartbeat with fake
  timers, the worker loop, the logger, building the Meilisearch document and
  the summary, re-sorting rows by Meilisearch's order, the sync plan and the
  tracked trigger set). Services are tested
  with a mocked repository, and `MeilisearchIndex` with a fake client. Not unit-tested, covered by
  e2e: the entrypoints, `create-server.ts`, `ws/ws-server.ts`, repositories
  and the schema (the exclusions are in `vitest.config.ts`).
- The e2e suite has its own coverage thresholds
  (`vitest.config.e2e.ts`, report in `coverage-e2e/`). Both threshold sets
  and the Stryker `break` mirror the API's values; the maintainer is the only
  one who moves them.
