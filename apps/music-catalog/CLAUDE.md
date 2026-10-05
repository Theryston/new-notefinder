# apps/music-catalog: Music catalog service

Read the root `CLAUDE.md` first; this file only adds this app's rules.

The **Music catalog** is a private, autonomous service that will hold every
**Recording** in the world (kept in sync with MusicBrainz, plus open
**Lyrics**), searchable in milliseconds. Internal clients (the API today,
others later) talk to it over one long-lived, authenticated **WebSocket**.
The full design is in the parent spec, issue #55; this file documents what
exists.

**What exists today**: the whole service. The authenticated WebSocket server
answering `status`, `getRecording` and `search` (issues #57, #59 and #58), the
protocol envelope, our own Postgres schema (the bootstrap state, the indexing
checkpoint, the recording outbox, the replication state, the reimport state
and the kept Lyrics), read-only declarations of the MusicBrainz tables the
queries read, **Meilisearch** as the search engine behind a small integration,
the `server` and `worker` entrypoints (the worker indexes every Recording once
the MusicBrainz data is laid down, then keeps the index in sync with it
through the outbox), the **first import** (issue #60, datasets reworked in
#85: the mbslave container lays down `tiny` or `full` and records
`restoring`/`restored`), **continuous replication** (issue #62: in `full` mode
the same container keeps applying replication packets after the catalog is
`ready`, records the sequence and reports it in `status`), the **Lyrics** from
LRCLIB (issues #63 and #64: the import, the strict match, the refresh and the
lookup for new Recordings), the **yearly schema-change reimport** (issue #69:
a CI job proposes the mbslave bump, then the service rebuilds the catalog
into a parallel copy with zero downtime), the **production deploy** (issue
#65: the two images CI publishes to GHCR and the single compose with Caddy in
`deploy/`, operated as "Operations (production)" below) and the test and
quality setup. `search` returns results in **Meilisearch's relevance order**,
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
                                                   # plus a one-shot mbslave container that lays down the
                                                   # tiny seed, then the worker indexes it to `ready`
nub run dev --filter=music-catalog                 # ws://localhost:3334
```

Watch `status` while `tiny` seeds (seconds the first
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
                          (`recordings-index.ts`) and of the lyrics index
                          (`lyrics-index.ts`)
  integrations/
    meilisearch/          MeilisearchIndex: the only code that imports the Meilisearch SDK
    mbslave/              MbslaveClient: the only code that spawns the mbslave binary
    lrclib/               the LRCLIB dump: download + stream-gunzip, open + schema
                          check + track/Lyrics reads, the public API client and
                          the fake-dump generator
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
      restore.service.ts        the first import mbslave owns: skip, redo, seed or restore
      restore-plan.ts           which of those a start has to do (pure)
      dump-urls.ts              the full-export archives under the base URL (pure + LATEST)
      tiny-seed.ts              the deterministic Recordings `tiny` seeds (pure)
      tiny-seed.repository.ts   writing those Recordings with plain SQL
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
    replication/
      replication.service.ts      the mbslave container's loop: wait for ready, sync, record, sleep
      replication.repository.ts   our copy of the applied sequence + mbslave's cursor
      replication-token.ts        the full-mode token requirement (pure)
    lyrics/
      lyrics-import.service.ts  the worker's LRCLIB import: dump, two-pass match, copy
      lyrics-refresh.service.ts the worker's LRCLIB refresh: newer dumps, changed Lyrics only
      lyrics-refresh.repository.ts  the checked and imported dump keys
      lyrics-lookup.service.ts  the worker's outbox lookup: Lyrics for new
                                Recordings from LRCLIB's public API
      match-batch.ts            pass one of the two-pass match, shared by the
                                import and the refresh (pure)
      lyrics.service.ts         the kept Lyrics (for `getRecording`) and their
                                documents (for indexing); the only way other
                                modules use Lyrics
      lyrics.repository.ts      the Recordings for matching, the kept Lyrics
      match-lyrics.ts           the strict match: normalization, ±2 s, album tie-break (pure)
    sync/
      sync.service.ts             the worker's continuous sync: triggers, outbox drain
      sync-plan.ts                outbox entries + current rows -> index writes (pure)
      sync-tracked-tables.ts      which MusicBrainz tables have a trigger, and the SQL builder
      recording-outbox.repository.ts  pending entries, done marks, trigger installer
      sync.*.spec.ts              unit tests of the plan, the service and the tracked set
  worker/worker-loop.ts   the loop the worker's steps plug into
  worker/worker-heartbeat.ts  the file the production health check reads (liveness)
Dockerfile                the Node image (server, worker and the migrations, by command),
                          built from the repo root; published to GHCR by CI
mbslave.Dockerfile        the mbslave image: Node for dist/restore.js plus mbslave from
                          git (pinned) and psql. `production` target (default): the
                          compiled restore built in, published to GHCR; `dev` target:
                          tooling only, run by the dev compose with the host's dist
docker-compose.yml        the DEV stack: our Postgres (5433), Meilisearch (7700) with its
                          key-creating job, and the one-shot mbslave service owning the
                          restore (started by `nub run infra:up`)
deploy/                   the PRODUCTION stack (see "Operations (production)"):
  compose.yaml            Caddy, server, worker, mbslave, Postgres, Meilisearch, migrations
  Caddyfile               TLS and the WebSocket proxy
  .env.example            every variable the production stack reads, placeholders only
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
  dataset: 'tiny' | 'full', replicationSequence?, pendingOutbox? }`, read
  from the bootstrap state row in our schema. The phases run in that order:
  the mbslave container records `restoring` and `restored` (it owns the
  MusicBrainz restore), then the worker waits for `restored` and records
  `indexing` and `ready`. While no row has been written, the answer is
  `restoring` with the configured `CATALOG_DATASET`. `replicationSequence`
  is the last replication packet the container applied (null until the first
  one lands; see "Continuous replication") and `pendingOutbox` the entries
  still waiting to reach the index — the replication lag. Both are absent
  when the service answers without replication state.
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
  built from the MBID alone (`cover_art` is loaded in neither dataset), so it can
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
- `lyrics` is `{ plain, synced }` (LRC text in `synced`) when a strict LRCLIB
  match exists (see "Lyrics (LRCLIB)"), `{ plain: null, synced: null }`
  otherwise. The service reads them through `LyricsService`, in parallel with
  the other parts.
- Loading: the service reads the parts in parallel (one query each, all in
  `RecordingRepository`, plus the Lyrics through `LyricsService`) and
  `assembleRecording` builds the answer without any I/O; the rules above live
  in those pure functions.

## `search`

Payload `{ query, scope?, limit?, offset? }`:

- `query`: text, trimmed, 1 to 256 characters (`SEARCH_MAX_QUERY_LENGTH`).
  Anything else, blanks included, is `VALIDATION_FAILED`.
- `scope`: `metadata` (default) or `lyrics`. The metadata scope only asks the
  `recordings` index (it never matches on Lyrics) and the lyrics scope only
  the `lyrics` index (see "Lyrics (LRCLIB)").
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
container runs `dist/restore.js` (`src/restore.ts`: in production built into
the published image, in the dev compose built on the host with
`nub run build --filter=music-catalog` and mounted read-only), which restores
when needed and then, in `full` mode, replicates continuously (see
"Continuous replication" below; in `tiny` mode it exits instead):

- **No row yet** (`fresh`): records `restoring`, then lays the dataset
  down. `full` reads the `LATEST` file under `MUSICBRAINZ_DUMP_BASE_URL`
  and restores the archives with `mbslave init --empty` followed by
  `mbslave import <urls>` (plain `init` is neither idempotent nor
  URL-configurable). `tiny` runs `mbslave init --empty` for the same
  schema and seeds the deterministic Recordings with plain SQL,
  downloading nothing. Either way it then records `restored`. A failure
  leaves `restoring` behind, so the next start redoes it; `ready` is the
  worker's to record, never the restore's.
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

`CATALOG_DATASET` is `tiny` or `full`, required with no default, and the
first import records it in the bootstrap state. `tiny` never touches the
network; `full` restores through `mbslave import <urls>`
(`src/modules/bootstrap/dump-urls.ts`):

- `tiny`: the same mbslave schema scripts plus 300 deterministic Recordings
  written with plain SQL (`tiny-seed.ts` + `TinySeedRepository`, no Drizzle
  tables, so a wrong column there fails the suite instead of passing
  twice). Development mode, seeded in seconds: about 1.5 s for the schema
  scripts and well under a second for the seed on a local Postgres, about
  24 MB of database, megabytes of Meilisearch index. The Lyrics import
  generates its fake dump from exactly these Recordings (same MBIDs
  and titles). There is no replication in this mode: the seed writes no
  `replication_control` row, so the replication worker stays off.
- `full`: core plus derived (`mbdump.tar.bz2` + `mbdump-derived.tar.bz2`
  under `<base>/fullexport/`), no edit history. Production mode: about
  150-220 GB steady state (see ADR 0002). Only `full` runs replication
  (MetaBrainz token required) and only matched Lyrics are kept there.

The dev loop runs on `tiny` (`nub run infra:up`, then `dev`): every search,
`getRecording` and Lyrics-scope query works end to end against it. Verify
against `full` before releases that touch the restore, the seed assumptions
or sizing: point `MUSICBRAINZ_DUMP_BASE_URL` at the official directory (or a
full mirror) with `CATALOG_DATASET=full` on a machine with the disk and the
hours the restore takes, and run the e2e suite's full-mode paths.

`MUSICBRAINZ_DUMP_BASE_URL` is the `.../data` directory the full export
lives under (default: the official `data.metabrainz.org` directory); `tiny`
ignores it. The mbslave binary reads its own `MBSLAVE_*` variables from
the container environment (use `MBSLAVE_DB_DB` for the database name;
mbslave ignores the README's `MBSLAVE_DB_NAME`); the dump download needs
no token. The image (`mbslave.Dockerfile`) installs mbslave from a pinned
git tag (`MBSLAVE_REF`, baked into the image for the stall check below):
a CI job proposes the bump (see "Yearly schema change"); bump `MBSLAVE_REF`
there together with `MBSLAVE_REF` in
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
- **`lyrics` index**, primary key `mbid` (the Recording's MBID). One document
  per Recording with kept Lyrics (`LyricsDocument`, `src/lib/lyrics-index.ts`):
  a single `lyrics` text, the plain Lyrics when known, else the synced lines
  without their LRC timestamps. `search` with `scope: lyrics` asks only this
  index, in the same way (MBIDs only, summaries from Postgres, Meilisearch's
  order kept); the server's search-only key already covers both indexes.
- **Indexing flow** (`IndexingService.run`, one worker tick): while the phase
  is `restoring` or there is no bootstrap row, nothing happens. On `restored`
  the worker records `indexing`, applies the settings **of both indexes**, and
  walks the
  Recordings by MusicBrainz's integer id, `INDEXING_BATCH_SIZE` at a time
  (default 2000): read the batch's documents (one query per kind of data per
  batch, not per Recording), send them, **wait for the Meilisearch task**, then
  write the checkpoint (`music_catalog.indexing_checkpoint`, one row per
  index). The kept Lyrics of the batch go to the `lyrics` index with it
  (replacing documents by MBID is idempotent, so they need no checkpoint of
  their own). When no Recording is left it records `ready`. A worker that dies or
  is restarted in the middle resumes after the checkpoint (a batch that was
  sent but not checkpointed is sent again, which replaces the same documents);
  a task that fails throws, the loop logs it and the next tick resumes. Aborting
  the worker's signal stops it after the batch in progress. Every tick drains
  the outbox first (a no-op until `ready`), imports the Lyrics (below, a
  no-op once `ready`), then runs the initial indexing (a no-op once `ready`).

## Lyrics (LRCLIB)

Lyrics come from the open **LRCLIB** dump (CC0): one `.sqlite3.gz` (about
48 GB, about 260 GB unpacked) published by hand every few weeks to months,
only the latest kept online, no checksum, no incremental form, listing at an
undocumented endpoint (see the spike, `docs/research/music-catalog-spike.md`
section 5). The worker imports it once per bootstrap, during the `indexing`
phase (`LyricsImportService.importOnce`, between the outbox drain and the
indexing run); refreshing it from a newer dump later is the refresh ticket's
job, not this import's.

- **Source per dataset.** In `full` the worker reads the latest key from
  `LRCLIB_LISTING_URL`, downloads `${LRCLIB_BASE_URL}/${key}` and gunzips it
  **as a stream** straight to its SQLite file: the `.gz` is never kept
  (about 260 GB of temp disk, deleted after the import). In `tiny` nothing
  is downloaded: a deterministic, seeded generator
  (`src/integrations/lrclib/fake-lrclib-dump.ts`) writes an SQLite file in the
  **real LRCLIB schema** from the seeded Recordings, with
  placeholder plain and synced Lyrics. It deliberately includes near-misses
  that must **not** match: a length just outside ±2 s, "(Live)" and remix
  titles, and an album tie on other albums. The same generator builds the e2e
  fixture served over HTTP, and the import and match code is identical for
  fake and real dumps.
- **Schema check.** The importer checks the dump right after opening it
  (`assertLrclibSchema`) and fails with an `LrclibSchemaError` naming the
  missing table or column when it drifted, so a stale fake cannot hide a real
  schema change. A failed import is logged (`LRCLIB import failed, continuing
  without Lyrics`) and the catalog still becomes `ready`: a bad dump must
  never hold the catalog back.
- **Two-pass import.** Pass one matches Recordings against the dump's
  lightweight track metadata (`tracks`: title, artist, album, duration)
  without reading Lyrics: it looks tracks up by both the raw-lowercase and
  the normalized title/artist (the dump's `_lower` columns may hold either
  spelling upstream), and the strict match below decides; pass two reads
  `lyrics` only for the matched track ids and copies them into our
  `music_catalog.recording_lyrics` (keyed by
  MBID). Unmatched Lyrics never reach our schema. The temp file is deleted
  afterwards.
- **Strict matching** (`matchLrclibTrack`, unit-spec'd): the normalized title
  **and** artist must be equal (normalization is lowercase without accents or
  punctuation, `normalizeLyricsText`, so a "(Live)" or remix title never
  matches), the length within **±2 s**, and when several tracks pass, exactly
  one must sit on one of the Recording's release titles (the album
  tie-breaker). No confident match means no Lyrics: a Recording without a
  length, or with only an album tie on other albums, keeps null Lyrics.
- **Reads.** `getRecording` returns the kept plain and synced (LRC) Lyrics,
  null otherwise. `search` with `scope: lyrics` searches the `lyrics` index
  (primary key the MBID), in Meilisearch's relevance order; the default
  `metadata` scope never touches it.
- **Refresh** (`LyricsRefreshService.refreshOnce`, one worker tick, `full`
  only): once the catalog is `ready`, each tick polls `LRCLIB_LISTING_URL`
  for a newer dump key (at most every `LRCLIB_REFRESH_CHECK_INTERVAL_MS`,
  default hourly) and, at most once per `LRCLIB_REFRESH_MIN_INTERVAL_DAYS`
  (default 30), imports it with the same two-pass strict match as the first
  import (`matchRecordingsBatch`, shared with it). Dumps the first import or
  an earlier refresh already brought in are skipped
  (`music_catalog.lrclib_refresh_state` remembers the checked and imported
  keys). Only Recordings whose Lyrics changed are written and reindexed in
  the `lyrics` index (Lyrics a newer dump lost are forgotten from both); the
  phase never moves, so `getRecording` and `search` keep answering
  throughout. A failed check or download only logs: the catalog serves the
  kept Lyrics until the next tick. In `tiny` the refresh never runs (it would
  need the network; the fake dump is generated instead).
- **Outbox lookup** (`LyricsLookupService`, one worker tick,
  `full` only): Recordings the outbox reports that have no kept Lyrics get
  them from LRCLIB's public API (`LRCLIB_API_BASE_URL`,
  `/api/get?artist_name&track_name&album_name&duration`). The tick peeks the
  candidates before the drain and fills them after it (`peekLyricless`, then
  `fillLyricless`), so a slow or failing API never holds the drain back. The
  one returned track goes through the same strict match; at most 10
  Recordings are asked per tick, a second apart, every request with a
  notefinder `User-Agent`. An API failure only logs: the Recording stays
  without Lyrics until the next dump refresh.
- **Disk and RAM.** About 260 GB of temp disk per `full` import (the steady
  state stays about 150-220 GB, see ADR 0002). Local development and tests
  use the generated fake dump and tiny fixtures, never the real one.

## Sync (outbox)

After the first import, every change to the MusicBrainz tables reaches the
`recordings` index through the outbox, while the service stays live:

- **Triggers** (`sync-tracked-tables.ts`): one `notefinder_sync_<table>`
  trigger per tracked table writes the affected Recording ids (with the MBID
  each had then) to `music_catalog.recording_outbox`. Both the `NEW` and the
  `OLD` row are enqueued, so deletes and moved links are caught; re-enqueueing
  re-arms the entry. This ticket owns the triggers: the worker installs (or
  replaces) them with plain SQL (`RecordingOutboxRepository.ensureTriggers`,
  idempotent, stale sync triggers and functions dropped), after the restore
  and before indexing, and again on every tick while any is missing — never
  a Drizzle migration, since the tables belong to mbslave. The triggers run
  as the role that writes the MusicBrainz tables; the deployment uses a
  single Postgres role for mbslave, the server and the worker (see
  `docker-compose.yml`), so no extra grant is needed — a deployment that
  split roles would have to grant the writer `INSERT` on
  `music_catalog.recording_outbox`.
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
  values for the dev master key. The production compose has the same job
  (`meilisearch-init`, the same uids); there the operator derives the two
  values from the master key once, with `openssl`, and puts them in `.env`
  (see "Meilisearch keys" under "Operations (production)"). The write key has
  `"indexes":["*"]`, since a blue-green reimport builds indexes under other
  names.

## Continuous replication

In `full` mode the mbslave container keeps applying MusicBrainz replication
packets after the first import (issue #62); in `tiny` mode replication
stays off (the seed writes an empty `replication_control`, so `mbslave sync`
could not start there anyway).

- **Loop** (`ReplicationService.run`, owned by `restore.ts` after the
  restore): requires a token (below, failing fast otherwise), waits for the
  catalog to be `ready` — the worker installs the change triggers after the
  restore and before indexing, so only then does every packet reach the
  outbox — then runs one-shot `mbslave sync` (which applies every pending
  packet and stops at the first missing one), records the sequence, logs it
  with the outbox backlog and sleeps ten minutes
  (`REPLICATION_POLL_INTERVAL_MS`). A throw (a bad token, a schema mismatch,
  a lost database) exits the container non-zero, so the compose
  `restart: on-failure` brings the loop back: it resumes from mbslave's own
  cursor and re-records the sequence. SIGINT/SIGTERM stop it after the sync
  in progress. The container is long-running in `full` (a failed restore is
  retried from `restoring`) and still one-shot in `tiny` (a clean exit is
  never restarted).
- **Sequence** (`replication_state`, one row, migrated normally): our copy of
  mbslave's cursor, written after every sync run and read by `status` next to
  the outbox backlog (`RecordingOutboxRepository.countPending`). mbslave's
  own `musicbrainz.replication_control` is declared read-only (like every
  file under `src/database/schema/musicbrainz/`) and only read from.
- **Token** (`MBSLAVE_MUSICBRAINZ_TOKEN` or
  `MBSLAVE_MUSICBRAINZ_TOKEN_FILE`): the 40-character MetaBrainz access
  token, free for non-commercial use (notefinder is non-commercial, decided
  after the spike). Required in `full` mode, validated at container startup
  (`assertReplicationToken`, before any download); the dump download itself
  needs no token. The file variant suits Docker secrets. The compose file
  passes both through with an empty default when unset, which the restore
  strips before spawning mbslave (`mbslaveSpawnEnv`: an empty `_FILE` path
  would make the binary crash opening it). Replication packets come from
  `MBSLAVE_MUSICBRAINZ_BASE_URL` (default: the official API), which the
  binary reads itself — point it at a mirror to test against one.
- **Licence**: replication packets and the derived dump are CC BY-NC-SA 3.0,
  so attribution is owed wherever genres and tags are shown. That display is
  web work, out of scope for this service; this note is the service's part.
- **Checking lag**: `status` answers `replicationSequence` (null until the
  first packet) with `pendingOutbox`. A healthy `full` catalog advances the
  sequence hourly and drains the backlog to zero between packets. Greppable
  loop logs (`docker compose logs -f music-catalog-mbslave`): `Applied
  replication packets` (with `previousSequence`, `sequence`,
  `pendingOutbox`), `Waiting for the catalog to be ready before replicating`
  and `Replication stopped: the container is stopping`; mbslave's own lines
  stream live as `mbslave output`.
- **Recovering from a stuck sequence**: a sequence that stops advancing while
  packets are published means replication stalled. First read the container
  log: a 403 is a bad or revoked token (fix the token, restart the
  container); `Mismatched schema` is the yearly MusicBrainz schema change
  (see "Yearly schema change" below — do not touch the database by hand); a lost
  database or mirror resolves itself on restart. The loop never rewinds
  mbslave's cursor, so restarting the container (`docker compose restart
  music-catalog-mbslave`) always resumes from the last applied packet; the
  worker's outbox then carries every change to the index. Never update
  `replication_control` or `replication_state` by hand: the two would
  disagree about what was applied.

## Yearly schema change (blue-green reimport)

About once a year (usually May), MusicBrainz changes its database schema and
replication stops until mbslave is upgraded. The service survives it without
downtime and with a single human step (issue #69):

1. **CI proposes the upgrade.** A scheduled workflow
   (`.github/workflows/music-catalog-mbslave-bump.yml`) watches mbslave
   releases and opens a PR bumping the pinned `MBSLAVE_REF` in
   `mbslave.Dockerfile`, `.env.example` and
   `test/setup/musicbrainz-schema.ts`. The music-catalog e2e suite runs on
   that PR against the new schema.
2. **The maintainer merges and deploys.** Merge the PR; CI builds and
   publishes the new images (the mbslave image carries the new tag), and the
   runbook below runs on the server (`docker compose pull && docker compose up
   -d` is its fourth step). In the dev compose the image rebuilds itself
   (`pull_policy: build`).
3. **An automatic blue-green reimport follows.** The next `mbslave sync`
   still fails, but the container now runs a newer mbslave major than the
   stalled one (an older release, the stalled one or an unrelated same-major
   patch keeps waiting), so instead of crash-looping it restores the new dump
   into the **parallel database** (`REIMPORT_DATABASE_URL`, a fresh database
   on the same server, migrated like the serving one) while the current copy
   keeps serving. Then the worker reinstalls the change triggers there,
   carries the kept Lyrics over (the strict match rerun from our own schema,
   no new LRCLIB download), indexes into the `recordings_next`/`lyrics_next`
   indexes and flips over: one atomic Meilisearch `swap-indexes` task for
   both index pairs, and the reads for the database (every repository
   resolves a reference the flip swaps, so in-flight requests finish on the
   old copy). The retired copy's indexes are deleted; its database is dropped
   unless `REIMPORT_CLEANUP_OLD_COPY=false`, which keeps it for inspection
   until the runbook below drops it.
4. **Watch `status`.** The first import's `phase` stays `ready` throughout
   (so `search` and `getRecording` never answer `CATALOG_NOT_READY` for a
   reimport), with `replicationStalled: { reason: 'schema-change' }` until
   the flip and `reimport: { phase, progressPct? }` while one runs
   (`restoring` → `indexing` → `switching`). A reimport interrupted by a
   crash or restart resumes on the parallel copy (the restore redoes from a
   clean state, indexing resumes after its checkpoint, the flip replays
   forward: a rerun that finds the flip record, or the swapped documents
   without it, completes the flip instead of swapping back, then every
   restarted process opens the new copy).

- **Disk.** About twice the steady state during a reimport (the parallel
  database plus the `*_next` indexes next to the serving ones), back to
  steady after the old copy is deleted. The LRCLIB temp disk is not needed:
  Lyrics are reused, never re-downloaded.
- **Enabling it.** The reimport needs a **fresh, migrated parallel database**
  (`REIMPORT_DATABASE_URL`, read by the mbslave container, the worker and the
  server's boot fallback), one per reimport: the container refuses a parallel
  database that holds a serving or retired catalog, and one that is the
  serving database itself. Without the variable, nothing ever reimports: the
  container keeps crash-looping on the stall and logs exactly what to set
  (`Replication stalled on the yearly schema change but REIMPORT_DATABASE_URL
  is unset`, with the steps). The database stays an explicit operator step on
  purpose: provisioning it means migrating it, and migrations are a deploy
  step, never run on boot. `tiny` mode never reimports either. In the dev
  compose, create it and run `DATABASE_URL=<it> nub run db:migrate` from
  `apps/music-catalog`; in production follow the runbook.
- **Runbook (production).** From the `deploy/` folder on the server, with free
  disk of about the steady state (see "Provisioning") and everything healthy
  in `docker compose ps`. Steps 1 to 3 can be done any time before the deploy.
  1. **Create the parallel database and migrate it** with the Node image (the
     same `migrate` job, pointed at the new database). Name it after the year
     of the reimport, `<POSTGRES_DB>_<year>` (`music_catalog_2027`, next year
     `music_catalog_2028`): a name is never reused, which the container
     requires, and it tells the copies apart.

     ```sh
     set -a; . ./.env; set +a
     docker compose exec postgres createdb -U "$POSTGRES_USER" "${POSTGRES_DB}_2027"
     docker compose run --rm \
       -e DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/${POSTGRES_DB}_2027" \
       migrate
     ```
  2. **Point the stack at it.** In `.env` uncomment
     `REIMPORT_DATABASE_URL=postgres://<user>:<password>@postgres:5432/<POSTGRES_DB>_2027`
     (the server, the worker and `mbslave` all receive it; while it is absent
     the variable is not set at all, which the processes require: a blank one
     is rejected as an invalid URL).
  3. **Delete the old dump archives** from the `dumps` volume, so the parallel
     restore downloads the new dump instead of reusing a stale file of the
     same name (see "The dumps volume" under "Operations (production)").
  4. **Merge the bump PR**, wait for the "Music catalog images" run on `main`
     to publish, then `docker compose pull && docker compose up -d`. The
     recreated `mbslave` container starts the parallel restore (hours, like
     the first import's restore); `docker compose logs -f mbslave` shows
     `Starting the parallel restore for the schema change`.
  5. **Watch** `status` (see "First run" for the command): `reimport` goes
     `restoring` → `indexing` → `switching`, then the log says `Reimport
     switched to the parallel copy` (`docker compose logs worker`).
  6. **After the flip, point the stack at the new copy.** In `.env` set
     `CATALOG_DATABASE=<POSTGRES_DB>_2027` and comment
     `REIMPORT_DATABASE_URL` out again, then `docker compose up -d`. This
     restarts `server`, `worker` and `mbslave` onto it, and it is required:
     with the default cleanup the retired database is dropped, so their pools
     fail (the flip's own tick ends failed and later ticks fail the same way:
     that error is the signal to restart, not a broken flip); and the
     `mbslave` binary reads its database name from its own environment
     (`MBSLAVE_DB_DB`), which `restore.ts` overrides only for the parallel
     restore, so the flip does not move it: replication stays down until it
     names the new database, which `CATALOG_DATABASE` does in the compose
     file. (`POSTGRES_DB` keeps naming the database Postgres created: it only
     matters at first init.)
  7. **Delete the dump archives again** (about 8 GB, and stale by next year),
     and check `docker compose exec postgres psql -U <user> -l`: the retired
     database is gone unless `REIMPORT_CLEANUP_OLD_COPY=false`, which keeps it
     for inspection until you `docker compose exec postgres dropdb -U <user>
     <old>` it.
- **After the flip.** Replication resumes from the new dump's cursor on the
  new copy once the processes run on it (step 6). Clients reconnect by
  themselves; between the flip and the restart requests fail instead of
  serving the old copy. With `REIMPORT_CLEANUP_OLD_COPY=false` the retired
  database is kept for inspection instead: the flip record survives in the
  new copy, so restarts keep opening it.
- **Crash windows.** The index swap is one Meilisearch task, so there is no
  half-swapped catalog. The residual window is the flip record right after
  it: a crash there replays the flip, finds the swapped documents through a
  sample of the parallel copy's ids (hundreds, so a differing copy is missed
  only by extreme bad luck; an identical copy is harmless either way) and
  completes forward instead of swapping back. If a flip ever looks wrong,
  compare the serving index counts with the serving database before dropping
  anything: `recordings` must hold the new copy's documents.
- **Greppable logs.** Until the bump, the container crash-loops on mbslave's
  own schema-mismatch message (`mbslave output`, then `Replication failed,
  the next start resumes it`) while `status` carries the stall. The reimport
  logs `Starting the parallel restore for the schema change`, `Reimport
  carried the kept Lyrics to the parallel copy` (with `carried`, `dropped`),
  `Reimport switched to the parallel copy` and `Adopted the reimported
  copy` once per process.

## Operations (production)

The production stack is `deploy/`: `compose.yaml`, `Caddyfile` and `.env.example`
(every variable, placeholders only). It runs the two images CI publishes to
GHCR (`music-catalog`, the Node image, and `music-catalog-mbslave`) plus
Caddy, Postgres 17 and Meilisearch v1.54.2, so the server needs **no source
code and no build toolchain**: copy those three files to it, fill `.env`, and
run `docker compose pull && docker compose up -d` from that folder. The dev
compose (`docker-compose.yml`, started by `nub run infra:up`) is a different
stack with different service names (`music-catalog-mbslave` there, `mbslave`
here); nothing in the dev loop reads `deploy/`.

### What runs

| Service | Image | Does | Liveness |
| --- | --- | --- | --- |
| `caddy` | `caddy:2.11-alpine` | TLS for `CATALOG_DOMAIN` (automatic HTTPS), proxies WebSocket upgrades to the server; the only published ports (80, 443) | its admin API |
| `postgres` | `postgres:17-alpine` | the catalog's database (ours plus MusicBrainz's) | `pg_isready` |
| `meilisearch` | `getmeili/meilisearch:v1.54.2` | the search engine, `MEILI_ENV=production`, master key from env | `/health` |
| `meilisearch-init` | same | one-shot: creates the search and write keys (fixed uids, idempotent) | exits 0 |
| `migrate` | `music-catalog` | one-shot: `node dist/database/migrate.js` | exits 0 |
| `server` | `music-catalog` | `node dist/server.js`, the WebSocket endpoint | plain `GET /` answers 426 |
| `worker` | `music-catalog` | `node dist/worker.js`; run exactly one | heartbeat file, see below |
| `mbslave` | `music-catalog-mbslave` | the first import, then continuous replication in `full` | none (see below) |

Only Caddy publishes ports; everything else is reachable on the project's
internal network only. `docker compose ps` is the first thing to read:
`migrate` and `meilisearch-init` end `Exited (0)` by design, and so does
`mbslave` in `tiny` (it is long-running in `full`).

- **Migrations are a deploy step.** `migrate` runs on every `docker compose up
  -d` before `server`, `worker` and `mbslave` start (they wait for it to
  succeed), so a `pull && up -d` migrates before the new code runs. The
  processes never migrate on boot. **A failing migration stops `up -d`
  half-way** (verified): `server` and `worker` are already recreated but are
  never started, so the service is down until you fix the cause (`docker
  compose logs migrate`) and run `up -d` again. To migrate before touching the
  running containers, run `docker compose run --rm migrate` between `pull` and
  `up -d` (see "Updates").
- **Restarts and health.** Compose restarts a container that *exits*
  (`unless-stopped`; `on-failure` for `mbslave`) but **does not restart one
  only because it is unhealthy**, and this stack deliberately has no autoheal
  sidecar and never mounts the Docker socket. So an `unhealthy` `server` or
  `worker` is visibility, not self-healing: `docker compose restart server
  worker`. (The spec's "Docker restarts unhealthy processes" cannot hold
  literally with plain Compose.) The server check proves the process answers
  HTTP, not that Postgres or Meilisearch are reachable (a `search` would
  fail with `INTERNAL`; see Troubleshooting). The worker check reads
  `WORKER_HEARTBEAT_FILE`, which a timer in the process keeps fresh every
  15 s: it proves the event loop turns. It is a timer on purpose, not "once
  per tick": a tick lasts hours during the first import (unpacking LRCLIB,
  indexing tens of millions of Recordings), and a tick failure is only a log
  line (`Worker tick failed`), so read the logs too. `mbslave` has no health
  check: it has no liveness signal and `tiny` exits by design, so watch
  `status` and its logs.

### Provisioning

The numbers for `full` come from the spike (`docs/research/music-catalog-spike.md`
section 4), the search benchmark (issue #68) and ADR 0002; the `full`
Meilisearch index and every timing are **extrapolated**, never measured at
full scale (and `full` is never run in development or CI). `tiny` numbers
were measured on the smoke run below.

| | `full` | `tiny` |
| --- | --- | --- |
| Steady-state disk | about **150-220 GB**: Postgres about 64 GB (48-80), Meilisearch 79-149 GB, WAL up to `POSTGRES_MAX_WAL_SIZE` (8 GB by default), plus the dump archives kept in the `dumps` volume (about 8 GB) | 86 MB of Postgres volume, 1.2 MB of Meilisearch, images about 1.3 GB (Node 383 MB, mbslave 959 MB, plus the upstream ones) |
| Temporary disk | about **260 GB** in the `lrclib-scratch` volume per LRCLIB import (the first import, then each refresh); about **2x the steady state** while a yearly reimport runs (the LRCLIB scratch is not needed then) | none |
| One-disk total | **at least 500 GB of SSD** (220 + 260 + 8 stays under it, and so does 2x 220) | any |
| RAM | **at least 16 GB**, more for lower search latency (below) | about 370 MiB for the five long-running containers at rest |
| First run | hours (below) | 56 s from `docker compose up -d` to `ready`, warm base images, on the smoke machine |

- **RAM and latency.** Meilisearch's latency depends on its index staying in
  the OS page cache: on the benchmark's 2.95 M-Recording sample (5.8 GB of
  data) p95 was 22 ms with the index in RAM and 97 ms with a 6 GiB memory
  cap. The full index is extrapolated at 79-149 GB, so 16 GB cannot hold it:
  most queries read the disk (use NVMe/SSD, never spinning disks), and the
  benchmark's extrapolation is a p95 of about 52 ms if the index stays in RAM
  (about 80 GB) up to about 4 s if it does not. 16 GB is the floor to run the
  stack, not a latency guarantee: buy RAM against the latency you want, and
  watch `docker stats` and the page cache (`free -h`) before and after
  traffic. While indexing, Meilisearch uses up to two thirds of the RAM by
  default and competes with Postgres (`POSTGRES_SHARED_BUFFERS`, 2 GB by
  default); the Node processes need little (about 40 MiB each at rest).
- **Network.** The first import downloads about 8.1 GB from MusicBrainz and
  47.6 GB from LRCLIB; the spike measured 1.0-1.5 MB/s from MetaBrainz (1.5 to
  2.2 hours) and about 16 MB/s from LRCLIB (about 50 minutes). Replication
  packets afterwards are small and hourly.
- **Other prerequisites.** A domain whose DNS record points at the server,
  ports 80 and 443 open to the internet (Caddy's certificate challenge and
  the clients), Docker with the Compose plugin, and a MetaBrainz token for
  `full`.
- **Where the volumes live.** Named volumes under Docker's data root
  (`/var/lib/docker/volumes`). To put the 260 GB `lrclib-scratch` volume on
  another disk, declare it in a `compose.override.yaml` with a bind mount or
  `driver_opts`; it only needs to be writable by uid 1000 (`node`).

### Before the first run

1. **GHCR login.** The repository is private, so its packages are too: log in
   once on the server with a GitHub **classic** personal access token that has
   the `read:packages` scope (fine-grained tokens cannot read packages):
   `echo "$TOKEN" | docker login ghcr.io -u <github-user> --password-stdin`.
   Docker keeps it in `~/.docker/config.json`. CI needs no secret to publish
   (it uses the workflow's own token).
2. **Copy the files.** `deploy/compose.yaml`, `deploy/Caddyfile` and
   `deploy/.env.example` (as `.env`, `chmod 600`) into one folder on the
   server.
3. **Fill `.env`.** Every value in the example is a placeholder, including the
   API key and the Meilisearch keys derived from the placeholder master key:
   replace them all.

   ```sh
   openssl rand -base64 32     # an API key (API_KEYS takes a comma-separated list)
   openssl rand -hex 24        # POSTGRES_PASSWORD (it goes into a URL: hex is safe)
   openssl rand -hex 32        # MEILISEARCH_MASTER_KEY
   ```

   then derive the two Meilisearch keys from the master key (see
   "Meilisearch keys"), set `CATALOG_DOMAIN`, `IMAGE_TAG`, and the MetaBrainz
   token (`MBSLAVE_MUSICBRAINZ_TOKEN`, free for non-commercial use, from the
   profile page of a MetaBrainz account with a verified email).
4. **Check it renders.** `docker compose config --quiet` fails with the name
   of any required variable left unset.
5. **Start.** `docker compose pull && docker compose up -d`.

### First run (`full`)

Expect **hours**: the spike estimated the MusicBrainz part at 4 to 8 hours on
its network (download 1.5-2.2 h, restore 1-2.5 h), and the LRCLIB import and
the Meilisearch indexing of 40.4 M Recordings come on top (the benchmark
indexed 2.95 M in about 14 minutes with per-slice time growing, so full scale
is several hours at least; no end-to-end figure exists). The service answers
from the first minute: `status` works, and `search` and `getRecording` answer
`CATALOG_NOT_READY` until `ready`. Do not restart the worker or reset the
volumes while it runs (see Troubleshooting for what a restart costs).

- **`status`** (works with no extra tooling, from the server):

  ```sh
  docker compose exec server node -e "
  const WebSocket = require('ws');
  const ws = new WebSocket('ws://127.0.0.1:' + process.env.PORT, {
    headers: { Authorization: 'Bearer ' + process.env.API_KEYS.split(',')[0] },
  });
  ws.on('open', () => ws.send(JSON.stringify({ id: '1', type: 'status', payload: {} })));
  ws.on('message', (message) => { console.log(String(message)); ws.close(); });
  "
  ```

  From anywhere, any WebSocket client does the same through Caddy:
  `wscat -c wss://<CATALOG_DOMAIN> -H "Authorization: Bearer <key>"`.
- **Phases**: `restoring` (the `mbslave` container downloads and restores the
  dump; `docker compose logs -f mbslave` shows `Restoring the MusicBrainz
  dump`, then mbslave's own progress as `mbslave output`, then `Restore import
  finished`), `restored`, `indexing` (the worker: **first the LRCLIB import**,
  `Downloading the LRCLIB dump` then `LRCLIB import finished`, which can take
  hours with no per-percent log; **then** `Indexed a batch of Recordings` with
  `percent`) and `ready`. `Indexing finished: the catalog is ready` is the last
  line.
- **Disk**: watch `df -h` and `docker system df -v` (the `lrclib-scratch` volume
  peaks near 260 GB during the import and is emptied by it).
- **When it is `ready`**, the steady state is `status` with a growing
  `replicationSequence` and `pendingOutbox` near zero (see "Continuous
  replication").

### Updates

```sh
docker compose pull && docker compose up -d
```

`pull` fetches the tag in `IMAGE_TAG`; `up -d` runs `migrate`, then recreates
only the containers whose image or settings changed (clients of a recreated
`server` are closed with 1001 and reconnect by themselves). `mbslave` is
recreated too when its image changed, and resumes from mbslave's own cursor.
For a release whose migrations you have not read, run them first, while the
old code still serves: `docker compose pull && docker compose run --rm migrate
&& docker compose up -d` (`migrate` is the new image's job; the later `up -d`
runs it again, a no-op).

- **Tag pinning.** `IMAGE_TAG=latest` (the example's value) follows the last
  build of `main`; for a reproducible deploy pin `sha-<short commit>` (CI
  tags every build with both, in the Actions run "Music catalog images" and
  on the GHCR package page). Both images always share a tag, so one value
  moves them together; the images are `linux/amd64` only. A tag exists only
  for commits that touched the app, its contracts, the lockfile or the
  workflow.
- **Rolling back** is the previous `sha-` tag and `up -d`. Migrations are
  forward-only: roll back across one only after reading its SQL in `drizzle/`.
- Check `docker compose ps` afterwards, then `docker image prune` the old
  layers.

### Meilisearch keys

The server never gets the master key: it uses a search-only key, and the
worker a key that can write. A Meilisearch key is **HMAC-SHA256 of its `uid`
with the master key**, and `meilisearch-init` creates both with fixed uids
(`5ea2c4a1-0000-4000-8000-000000000001` search, `...0002` write), so their
values are computed once with `openssl` and put in `.env` (verified against a
real Meilisearch v1.54.2, and against the dev values in `.env.example`):

```sh
MASTER=<the MEILISEARCH_MASTER_KEY value>
printf '%s' '5ea2c4a1-0000-4000-8000-000000000001' | openssl dgst -sha256 -hmac "$MASTER" -hex   # MEILISEARCH_SEARCH_API_KEY
printf '%s' '5ea2c4a1-0000-4000-8000-000000000002' | openssl dgst -sha256 -hmac "$MASTER" -hex   # MEILISEARCH_WRITE_API_KEY
```

Keep only the 64-character hex value of each output line (after
`SHA2-256(stdin)= `). No `curl` is needed, and the init job is idempotent (HTTP
409 means the key exists), so it is safe on every `up -d`.

### Key rotation

- **API keys** (`API_KEYS`): list the new key next to the old one
  (`new,old`), `docker compose up -d`, move the clients to the new one, then
  drop the old one and `up -d` again. Each `up -d` that changes the list
  recreates `server`, `worker` and `migrate`; clients reconnect by themselves.
- **Meilisearch**: the search and write keys are derived from the master key,
  so they rotate **together**. Put the new master in `MEILISEARCH_MASTER_KEY`,
  derive both keys again (above), update the three values in `.env` and `docker
  compose up -d`. Verified on a real Meilisearch with the same data volume:
  the old derived keys are refused (`invalid_api_key`), the new ones are
  accepted, `GET /keys` lists the same uids with the new values, and nothing
  is reindexed. Searches fail between Meilisearch's restart and the server's.
  Rotating only one of the two needs a new `uid` (a change to the init job).
- **Postgres password**: `POSTGRES_PASSWORD` only applies when the volume is
  first created, so change it in the database first, then in `.env`:
  `docker compose exec postgres psql -U <user> -d <db> -c "ALTER ROLE <user>
  PASSWORD '<new>'"`, set `POSTGRES_PASSWORD` to the same value, `docker
  compose up -d`. Changing only `.env` makes every process fail with
  `password authentication failed for user` (verified).
- **MetaBrainz token**: change `MBSLAVE_MUSICBRAINZ_TOKEN`, `docker compose up
  -d mbslave`. A revoked or wrong token is mbslave's HTTP 403 in its log.
- **Caddy's certificates** are renewed by Caddy itself and live in the
  `caddy-data` volume; losing that volume only means asking the certificate
  authority again (which is rate limited).

### The dumps volume (read this before any redo or reimport)

mbslave downloads the MusicBrainz archives into `/var/lib/mbslave` (the
`dumps` volume) as `mbdump.tar.bz2` and `mbdump-derived.tar.bz2`, **keeps
them after the restore**, and its downloader resumes from whatever file of
the same name is there (a `Range` request from its current size). The name
does not include the dump's date, and MusicBrainz publishes a new full export
twice a week. Verified with mbslave v31.0.1's own downloader against a local
server: a stale archive at least as big as the new one is silently reused
(the new dump is never downloaded), and a smaller one gets the tail of the new
file appended to its head, a corrupt tarball. So the archives are **stale
after the first import**: delete them once the catalog is `ready` (it frees
about 8 GB), and **always before** a redo or a reimport restores again:

```sh
docker compose run --rm --no-deps --entrypoint rm mbslave -f \
  /var/lib/mbslave/mbdump.tar.bz2 /var/lib/mbslave/mbdump-derived.tar.bz2
```

(Leave them while a download is merely being resumed after a restart: that is
what they are for.)

### Backups and recovery

Everything in the catalog is **rebuilt from public data** (MusicBrainz and
LRCLIB), so the baseline is: back up the configuration, not the data, and
accept hours of rebuild after a total loss. What is not rebuildable is the
**`.env`** (the API keys, the Meilisearch master key and the MetaBrainz
token: keep it in a password manager) and, politely, the `caddy-data` volume
(certificates; re-issuing is rate limited). Beyond that:

- **A consistent cold backup** (fastest recovery): `docker compose stop
  worker mbslave server`, then copy the `postgres-data` **and**
  `meilisearch-data` volumes together (for example `docker run --rm -v
  music-catalog_postgres-data:/data -v "$PWD":/backup alpine tar czf
  /backup/postgres.tgz -C /data .`, and the same for Meilisearch), then
  `docker compose start`. They must come from the same moment: the index and
  the database drift otherwise. (Meilisearch has its own snapshot and dump
  features, which this stack does not set up.)
- **Postgres only** (`pg_dump`, a volume copy, a replica) is the common case,
  and **restoring it next to an empty Meilisearch volume does not rebuild the
  index by itself**. Verified on the `tiny` stack: with the Meilisearch volume
  deleted and Postgres intact, `status` still says `ready` (the worker thinks
  everything is indexed: the checkpoint lives in Postgres and indexing is a
  no-op once `ready`), the worker only drains new outbox entries, and every
  `search` answers `INTERNAL`, with "Index `recordings` not found" in the
  server log. Force the reindex by putting the catalog back in `indexing` and
  clearing the checkpoint:

  ```sh
  docker compose exec postgres psql -U <user> -d <db> \
    -c "UPDATE music_catalog.bootstrap_state SET phase = 'indexing'" \
    -c "DELETE FROM music_catalog.indexing_checkpoint"
  ```

  The worker's next ticks reindex every Recording and the kept Lyrics from
  Postgres and the catalog is `ready` again (`search` answers
  `CATALOG_NOT_READY` meanwhile; `tiny` took 36 s). **In `full` that also
  re-downloads LRCLIB's dump** (about 48 GB, 260 GB unpacked, hours): the
  import runs whenever the phase is `indexing`, with no check for Lyrics
  already kept. That is the price of not backing the two up together.
- **Starting from nothing**: `docker compose down -v` deletes the volumes,
  and the next `up -d` is a first run. Never run it against a catalog worth
  keeping.

### Troubleshooting

Logs: `docker compose logs -f --tail 200 <service>` (JSON lines, one per
event; grep the quoted messages).

| Symptom | Look at | Cause and fix |
| --- | --- | --- |
| `docker compose` refuses with `required variable ... is missing` | `.env` | set it (the message names it) |
| `pull` fails with `denied` or `unauthorized` | `docker login ghcr.io` | log in with a `read:packages` token (see "Before the first run") |
| `migrate` ends `Exited (1)`, `server` and `worker` stay `Created` | `logs migrate` | the service is down until this is fixed and `up -d` runs again; `password authentication failed` is a `POSTGRES_PASSWORD` that does not match the database (see "Key rotation"); a dataset error means a database from the dropped `sample` dataset |
| Caddy serves no certificate, TLS errors | `logs caddy`, DNS, ports 80/443 | the domain must resolve to this server and 80/443 must be open; certificates are rate limited, so fix DNS before retrying |
| `server` or `worker` `unhealthy` | `logs server` / `logs worker` | read the error, then `docker compose restart <service>`; Compose will not restart it for you |
| `status` stuck in `restoring` | `logs -f mbslave` | `Restore failed, the next start redoes it`: the container restarts by itself and redoes it from a clean state; check the disk (`df -h`), the MetaBrainz URL, and that the archives in the `dumps` volume are not stale (see above) |
| `status` stuck in `indexing` for hours | `logs worker` | normal while the LRCLIB import runs (no per-percent log); `LRCLIB import failed, continuing without Lyrics` means a bad dump (the catalog still becomes `ready`); `Worker tick failed` repeating is a failing step (Meilisearch down, disk full): the error is in the line |
| Disk full during the first import or a refresh | `docker system df -v`, `ls -la` of `lrclib-scratch` | the worker deletes its unpacked dump when an import ends, **not when it is killed or crashes**: `docker compose run --rm --no-deps --entrypoint ls worker -la /scratch`, then `... --entrypoint rm worker -f /scratch/lrclib-dump-<n>.sqlite3` for leftovers. A worker restart in the middle of `indexing` also restarts the whole LRCLIB download (there is no resume) |
| `search` answers `INTERNAL` while `status` is `ready` | `logs server` | "Index recordings not found": Meilisearch lost its data (see "Backups and recovery"); a connection error is Meilisearch down (`docker compose ps meilisearch`); `invalid_api_key` is a Meilisearch key that does not match the master key (derive them again) |
| `replicationSequence` stops advancing | `logs mbslave` | 403 is a bad token; `Mismatched schema` / `Replication stalled on the yearly schema change` is the yearly schema change ("Yearly schema change"); see "Continuous replication" for the log lines |
| Port 80 or 443 already in use | `docker compose up -d` error | another web server on the host: stop it, Caddy needs both |

### Licence

notefinder is **non-commercial**, which is what the free MetaBrainz token
requires. The replication packets and the derived dump (tags and genres) are
**CC BY-NC-SA 3.0**: attribution is owed wherever genres and tags are shown
(web work, outside this service), and if notefinder ever becomes commercial
the MetaBrainz tier and that data must be revisited first (ADR 0002). LRCLIB's
dump is CC0. This is not legal advice.

### CI and images

`.github/workflows/music-catalog-images.yml` builds both images on every pull
request that touches the app, its contracts, the lockfile or the workflow
(nothing is pushed), validates the compose against `deploy/.env.example`
(`docker compose config`, the Caddyfile, that every variable the compose reads
is in the example, and that every variable `src/config/env.ts` parses is
wired in the compose), and on a push to `main` publishes
`ghcr.io/<owner>/<repo>/music-catalog` and `.../music-catalog-mbslave` tagged
`sha-<short commit>` and `latest` with the workflow's own `GITHUB_TOKEN` (no
secret to create). `apps/music-catalog/Dockerfile` and `mbslave.Dockerfile`
build from the repository root, inside the image (`nub install --frozen-lockfile`
and `tsc`), so a local `docker build -f apps/music-catalog/Dockerfile .`
reproduces CI. Keep the two Dockerfiles' build stages in step.

### Smoke run (`tiny`), the procedure to check a change to the stack

Repeat it after any change to the compose, the Dockerfiles or the health
checks. Never run `full` for this. It needs only Docker and free ports 80 and
443: the images are built in the image and nothing is pulled from or pushed to
GHCR. From the repository root:

```sh
docker build -f apps/music-catalog/Dockerfile -t mcsmoke/music-catalog:local .
docker build -f apps/music-catalog/mbslave.Dockerfile -t mcsmoke/music-catalog-mbslave:local .

# What differs from the example env: the tiny dataset, a local-only domain
# (Caddy signs it with its own authority) and the local images.
printf '%s\n' COMPOSE_PROJECT_NAME=mcsmoke CATALOG_DATASET=tiny CATALOG_DOMAIN=localhost \
  IMAGE_REPOSITORY=mcsmoke IMAGE_TAG=local > /tmp/mcsmoke.env
cd apps/music-catalog/deploy
docker compose --env-file .env.example --env-file /tmp/mcsmoke.env up -d
```

Then wait for `ready` and run one `search` and one `getRecording` through
Caddy with the example's API key, from a throwaway container on the host
network (no certificate check: the local authority is not trusted):

```sh
docker run --rm --network host -e KEY=change-me-api-key-0123456789abcdef0123456789abcdef \
  mcsmoke/music-catalog:local node -e "
const WebSocket = require('ws');
const ws = new WebSocket('wss://localhost', {
  headers: { Authorization: 'Bearer ' + process.env.KEY },
  rejectUnauthorized: false,
});
const call = (type, payload) => new Promise((resolve) => {
  const id = String(Math.random());
  const onMessage = (message) => {
    const reply = JSON.parse(String(message));
    if (reply.id !== id) return;
    ws.off('message', onMessage);
    resolve(reply);
  };
  ws.on('message', onMessage);
  ws.send(JSON.stringify({ id, type, payload }));
});
const show = (reply) => console.log(JSON.stringify(reply).slice(0, 150));
ws.on('open', async () => {
  let status;
  let shown;
  do {
    status = await call('status', {});
    if (status.result.phase !== shown) show(status);
    shown = status.result.phase;
    if (shown !== 'ready') await new Promise((r) => setTimeout(r, 2000));
  } while (shown !== 'ready');
  const search = await call('search', { query: 'Tiny Song 042', limit: 1 });
  show(search);
  show(await call('getRecording', { mbid: search.result.results[0].mbid }));
  ws.close();
});"

# still in apps/music-catalog/deploy
docker compose --env-file .env.example --env-file /tmp/mcsmoke.env ps -a   # server, worker, caddy healthy; migrate, meilisearch-init Exited (0)
docker compose --env-file .env.example --env-file /tmp/mcsmoke.env down -v # removes the stack and every volume of the smoke project
docker image rm mcsmoke/music-catalog:local mcsmoke/music-catalog-mbslave:local
rm /tmp/mcsmoke.env
```

(The upstream images it pulled, `caddy:2.11-alpine` and the Postgres and
Meilisearch ones, are shared cache: remove them only if nothing else on the
machine uses them.) `status` shows `restored`, then `indexing` (the worker
imports the fake LRCLIB dump, then indexes the 300 Recordings), then `ready`,
and the search finds `Tiny Song 042`.

Measured on the machine that wrote this ticket (15 GB RAM, Docker 29.7, base
images already pulled), from the commands above on a clean project: **56 s
from `docker compose up -d` to `ready`** (the migrations at +10 s, the `tiny`
restore done at +23 s, then about 30 s of the worker generating and importing
the fake LRCLIB dump and 2 s indexing), a cold build (no layer cache) of the
Node image in **79 s** and of the mbslave image in **148 s**, **86 MB** of
Postgres volume, **1.2 MB** of Meilisearch, an empty `dumps` and
`lrclib-scratch`, and under 0.5 GB of RAM for the five long-running
containers (about 370 MiB at rest). The images are 383 MB (Node) and 959 MB
(mbslave).

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
- `replication_state` is a single-row table like `bootstrap_state`: the last
  replication packet applied (`last_sequence`, `updated_at`). The mbslave
  container writes it after every sync run; no row until the first packet
  lands (see "Continuous replication"). A schema mismatch also records the
  stall there (`stalled_reason`, `stalled_detail`, `stalled_mbslave_ref`),
  cleared when sync applies packets again or the reimport flips.
- `reimport_state` is a single-row table for the blue-green reimport
  (`phase` `restoring` | `indexing` | `switching`, `progress_pct`,
  `detail`; see "Yearly schema change"). The container writes `restoring`
  and the worker moves it to `indexing` and `switching`; after the flip it
  holds `switched` with the new serving database URL, overwritten by the
  next reimport.
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
  | `CATALOG_DATASET` | `tiny` or `full`; required, no default |
  | `HEARTBEAT_INTERVAL_MS` | Ping interval (default 30000) |
  | `REQUEST_TIMEOUT_MS` | Per-request timeout (default 10000) |
  | `MEILISEARCH_URL` | Meilisearch, `http(s)://` (dev compose: port 7700); server and worker |
  | `MEILISEARCH_SEARCH_API_KEY` | Search-only key; required by the **server** only |
  | `MEILISEARCH_WRITE_API_KEY` | Key that can write; required by the **worker** only |
  | `INDEXING_BATCH_SIZE` | Recordings per Meilisearch task while indexing (default 2000, 1 to 10000); worker |
  | `MUSICBRAINZ_DUMP_BASE_URL` | The `.../data` directory the dumps are published under (default: the official one); restore (see "First import") |
  | `MBSLAVE_REF` | The mbslave release in the mbslave image (baked in from its build argument); recorded with a schema-change stall (see "Yearly schema change") |
  | `REIMPORT_DATABASE_URL` | The parallel database a reimport rebuilds (same server, other database); absent, nothing ever reimports (see "Yearly schema change"); restore, worker and server (boot fallback) |
  | `REIMPORT_CLEANUP_OLD_COPY` | Anything but `false` drops the retired database after the flip; `false` keeps it for inspection |
  | `MBSLAVE_MUSICBRAINZ_TOKEN` | The MetaBrainz access token itself; required in `full`, ignored in `tiny` (see "Continuous replication") |
  | `MBSLAVE_MUSICBRAINZ_TOKEN_FILE` | A file holding the token (Docker secrets); alternative to the above |
  | `LRCLIB_BASE_URL` | The directory the LRCLIB dump files live under; the latest key is appended to it (default: LRCLIB's own); worker, `full` only (see "Lyrics (LRCLIB)") |
  | `LRCLIB_LISTING_URL` | The endpoint listing the published LRCLIB dumps, read for the latest key (default: LRCLIB's own); worker, `full` only |
  | `LRCLIB_API_BASE_URL` | The public LRCLIB API new and changed Recordings get their Lyrics from (default: LRCLIB's own); worker, `full` only (see "Lyrics (LRCLIB)") |
  | `LRCLIB_REFRESH_CHECK_INTERVAL_MS` | How often the worker polls the listing for a newer dump (default 3600000); worker, `full` only |
  | `LRCLIB_REFRESH_MIN_INTERVAL_DAYS` | At most one dump refresh per this many days (default 30); worker, `full` only |
  | `WORKER_HEARTBEAT_FILE` | A file the worker keeps touching (every 15 s) for the production health check; unset, nothing is written (see "Operations (production)") |

  The production stack's own variables (the domain, the image tag, Postgres
  and Meilisearch settings, and these ones as the compose passes them) are
  listed, with placeholders, in `deploy/.env.example`; CI checks that every
  variable above is wired in `deploy/compose.yaml`.

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
  --empty` runs (mbslave pinned to a git tag, constant `MBSLAVE_REF`;
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
  HTTP server (`test/utils/fake-dump-server.ts`, the real `fullexport`
  layout with tiny archives). It covers the first run to `ready` in each
  dataset (`tiny` seeds with the real `TinySeedRepository` and downloads
  nothing; `full` downloads over real HTTP), then a worker tick and a
  search over the WebSocket, the skip on a second start, the redo from a
  clean state after an interrupted restore (it drops the real `musicbrainz`
  schema, so it re-applies it in a `finally` for the files after it) and
  the refusal to switch datasets. Spawning the real binary is deliberately out: it would
  need its Python/psql image, minutes per run and the network on every PR
  (the spike verified the real commands against a fake mirror instead).
- **Replication in e2e** (`test/replication.e2e-spec.ts`): the real
  `ReplicationService` wired like `restore.ts`, with mbslave behind its
  integration boundary (a fake `MbslaveRun`: `sync` moves mbslave's own
  cursor the way an applied packet would) and the trigger-written outbox as
  the backlog. It covers the recorded sequence and the backlog in `status`
  (null before the first packet, recorded after a run, kept when a run
  applies nothing new). Spawning the real `sync` is deliberately out for the
  same reasons as the first import, plus a MetaBrainz token; so is the
  container's crash-restart, which is a compose `restart: on-failure` policy
  (unit tests prove a failed sync propagates instead of going quiet).
- **The reimport in e2e** (`test/reimport-stall.e2e-spec.ts`,
  `test/reimport-indexing.e2e-spec.ts`, `test/reimport-switch.e2e-spec.ts`,
  `test/reimport-recovery.e2e-spec.ts` and
  `test/reimport-cleanup.e2e-spec.ts`, sharing
  `test/utils/reimport-harness.ts`): the real stall, state machine,
  Meilisearch swap and cutover against a second database on the same server
  (created and migrated by the harness, `*_reimport`), with the binary faked
  behind the same boundary (a fake `sync` fails with the schema mismatch, a
  fake `init`/`import` lays the "new dump" next door, downloading its
  archives over real HTTP from the fake dump server like the first-import
  path does). They cover the stall in `status` while search and
  `getRecording` answer, serving from the current copy during the reimport,
  the atomic switch with the old indexes deleted, Lyrics carried without any
  download (the LRCLIB endpoints are closed ports), a worker and a container
  restarted mid-reimport, a flip lost after the swap and one lost before the
  flip record (both complete forward instead of swapping back), the retired
  database dropped by default (on scratch databases, never the shared one:
  the flip drops the serving database, so the runbook restarts the processes
  onto the new copy), and that `CATALOG_NOT_READY` never answers. Each test
  boots its own server: a switch test flips its process to the parallel
  database, and the next test must read the serving copy again. The parallel
  database is dropped in `afterAll`; each suite reuses one per file and
  resets it (tables plus sync triggers) per test.
- **The Lyrics import in e2e** (`test/lyrics.e2e-spec.ts`): in `tiny` mode the
  worker tick generates the fake dump, imports and indexes it, and the spec
  asserts over the WebSocket that a matched Recording has plain and synced
  Lyrics, that the tie and length-less Recordings have none, that a
  lyrics-scope search finds a Recording by a line of its Lyrics (first, in
  Meilisearch's relevance order) and that the metadata scope never matches on
  Lyrics. In `full` mode a tiny dump built by the same generator is served
  gzipped by a fake HTTP server (`test/utils/fake-lrclib-server.ts`, listing
  plus files, like `fake-dump-server.ts`), and the spec covers the download
  path the same way, plus a dump with an unexpected schema: the tick still
  reaches `ready`, with null Lyrics. `useEmptyLyricsIndex()` (in
  `test/utils/test-worker.ts`) deletes the `lyrics` index before each test,
  next to `useEmptySearchIndex()`.
- **The Lyrics refresh in e2e** (`test/lyrics-refresh.e2e-spec.ts`): in
  `full` mode, with the dump listing and the public API behind fake HTTP
  servers (`test/utils/fake-lrclib-server.ts` and
  `test/utils/fake-lrclib-api-server.ts`). It covers the refresh from a newer
  dump over a worker tick (`getRecording` returns the new Lyrics and the
  lyrics scope finds the new text, still in Meilisearch's relevance order),
  the skip of an already-imported dump (no second download), the wait past
  the minimum interval (still imported once it passes), the Lyrics of an
  outbox Recording from the API (with the `User-Agent` the fake server
  records), including one added after `ready`, and the failure paths: an API
  failure leaves the Recording without Lyrics while the outbox still drains
  (even while a lookup hangs), a non-matching API track is rejected, and a
  listing failure leaves the catalog ready with null Lyrics.

- **The production deploy** (`deploy/`, the two Dockerfiles) has no spec of
  its own: the "Music catalog images" workflow builds both images on every
  pull request that touches them and checks the compose (it renders against
  `deploy/.env.example`, every variable it reads is in the example, every
  variable `src/config/env.ts` parses is wired in it, and the Caddyfile is
  valid). The behavior itself is verified by the smoke run under "Operations
  (production)", which a change to the compose, the Dockerfiles or the health
  checks must repeat.
- Unit (`*.spec.ts` next to the file): pure logic only (env parsing, API key
  check, envelope parsing and error mapping, handlers and their payload
  validation, the dispatcher with its timeout, the WebSocket heartbeat with
  fake timers, the worker loop and its heartbeat file, the abortable sleep, the logger, building the Meilisearch document and
  the summary, re-sorting rows by Meilisearch's order, the sync plan and the
  tracked trigger set, the replication loop and its token gate, the Lyrics
  normalization and match, the shared match batch, the fake-dump generator,
  the dump download, the public API client, the Lyrics import, refresh and
  lookup). Services are tested
  with a mocked repository, and `MeilisearchIndex` with a fake client. Not unit-tested, covered by
  e2e: the entrypoints, `create-server.ts`, `ws/ws-server.ts`, repositories
  and the schema (the exclusions are in `vitest.config.ts`).
- The e2e suite has its own coverage thresholds
  (`vitest.config.e2e.ts`, report in `coverage-e2e/`). Both threshold sets
  and the Stryker `break` mirror the API's values; the maintainer is the only
  one who moves them.
