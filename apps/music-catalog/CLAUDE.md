# apps/music-catalog: Music catalog service

Read the root `CLAUDE.md` first; this file only adds this app's rules.

The **Music catalog** is a private, autonomous service that will hold every
**Recording** in the world (kept in sync with MusicBrainz, plus open
**Lyrics**), searchable in milliseconds. Internal clients (the API today,
others later) talk to it over one long-lived, authenticated **WebSocket**.
The full design is in the parent spec, issue #55; this file documents what
exists.

**What exists today**: the authenticated WebSocket server answering `status`
and `getRecording` (issues #57 and #59), the protocol envelope, our own
Postgres schema (the bootstrap state), read-only declarations of the
MusicBrainz tables `getRecording` reads, the `server` and `worker`
entrypoints (the worker is a no-op loop) and the test and quality setup.
Search, the MusicBrainz restore and bootstrap, the search engine,
replication, Lyrics and the production compose are later tickets: do not
build them here ahead of their ticket. The **search engine is still to be
chosen** (a benchmark of tuned Sonic, Meilisearch and Postgres full-text
search, issue #68); whatever it is, `search` will return results in the
engine's relevance order, loaded from Postgres without re-ranking.

Stack: Node/TypeScript **without Nest**, ESM, `ws`, Drizzle ORM + PostgreSQL
(`pg`), Zod (protocol schemas come from `@notefinder/contracts`), Vitest,
Testcontainers. Not a public API: it has no OpenAPI, no versioned URLs and no
users; only trusted services with an API key connect.

## Commands

```sh
nub run dev          # server + worker in watch mode (tsx watch), port from PORT (default 3334)
nub run build        # tsc -> dist/ (start:server / start:worker run the compiled entrypoints)
nub run test         # unit tests (*.spec.ts)
nub run test:cov     # unit tests + coverage thresholds (report in coverage/)
nub run test:e2e     # e2e tests (test/*.e2e-spec.ts) against a Testcontainers Postgres
                     # (needs Docker, or E2E_DATABASE_URL, see Testing); report in coverage-e2e/
nub run test:mutation --filter=music-catalog   # Stryker
nub run check-types
nub run lint         # biome + dependency-cruiser
```

Local setup, from the repository root:

```sh
nub install
nub run infra:up                                   # includes this app's Postgres on port 5433
cp apps/music-catalog/.env.example apps/music-catalog/.env
(cd apps/music-catalog && nub run db:migrate)
nub run dev --filter=music-catalog                 # ws://localhost:3334
```

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
  worker.ts               entrypoint of the worker process (a no-op loop for now)
  create-server.ts        composition root of the server: modules -> handlers -> ws server
  config/env.ts           Zod schema for process.env, parsed once at boot
  logger.ts               minimal structured logger (JSON in production)
  errors/                 CatalogError: an expected failure with a protocol error code
  lib/                    small pure helpers shared by modules (text comparison, cover art URL)
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
    recording/
      recording.handler.ts      the `getRecording` handler
      recording.service.ts      readiness, not found / moved, loading the parts
      recording.repository.ts   the queries on the MusicBrainz tables
      recording-data.ts         the rows the repository returns
      assemble-recording.ts     rows -> the protocol's Recording (pure)
      genre-fallback.ts         which level the genres and tags come from (pure)
      release-event.ts          the date and country a release is shown with (pure)
  worker/worker-loop.ts   the loop the worker's steps plug into
drizzle/                  generated SQL migrations (committed)
test/                     e2e specs + helpers (test server, ws client, Testcontainers setup,
                          MusicBrainz schema and fixture)
```

- A feature module owns its handler(s), service, repository and tests. Other
  modules use it only through its **service**.
- `ws/` is generic protocol code. A feature plugs in a handler; `ws/` never
  imports `modules/`.
- Third-party clients (the search engine, once chosen in #68, and HTTP
  downloaders) will live in `integrations/`, wrapped behind a small typed
  class, one folder each.

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
  `createWsServer`. A new module adds its lines there.
- `nub run lint` runs dependency-cruiser (`.dependency-cruiser.cjs`), which
  enforces this: no cycles, only repositories (and `src/database/`) touch
  Drizzle, handlers never import repositories, services and repositories
  never import handlers or `ws/`, `ws/` never imports modules.

## ESM details

- `"type": "module"` + `nodenext`: relative imports **must** end in `.js`
  (`import { BootstrapService } from './bootstrap.service.js'`).
- Top-level `await` is fine (see `server.ts`). No `require`, no `__dirname`
  (use `import.meta.dirname` / `new URL(..., import.meta.url)`).
- `tsx` runs the TypeScript in dev and for `db:migrate`; production runs the
  output of `tsc` (`dist/`).

## Protocol (`@notefinder/contracts`, `music-catalog.ts` and `music-catalog-recording.ts`)

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
- `type` is `status` or `getRecording` today (`search` comes later).
  `payload` is validated per type; `status` takes none (missing or `{}`).
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
- Every operation that reads the catalog (`getRecording`, later `search`)
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

- Logging: `createLogger` from `src/logger.ts` (one JSON object per line in
  production, text otherwise). No `console.*`. Never log API keys, the
  `Authorization` header or whole request bodies.
- Shutdown: on SIGINT/SIGTERM the server closes every connection with 1001,
  stops listening and closes the pool; the worker finishes its current tick
  and exits. Keep both stateless so several instances can run.

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
  schema is left as is.
- **The MusicBrainz fixture** (`test/utils/musicbrainz.ts` and
  `musicbrainz-relations.ts`): small helpers that write rows with plain SQL,
  the way a dump or a replication packet would (`addArtist`, `addRecording`,
  `addRecordingRedirect`, `deleteRecording`, `addIsrc`, `addRelease`,
  `addTrack`, `addWork`, `addExternalUrl`, `addGenre`, `addTag`, `mbid(n)`
  for readable MBIDs), deliberately **not** through the service's own Drizzle
  declarations, so a wrong column name there fails a spec. `resetDatabase`
  (run by `useTestClient`) also empties every table the fixture writes to, so
  a new helper that writes to another table must add it to `FIXTURE_TABLES`.
  Search and sync tests build on these; add a helper instead of writing SQL
  in a spec. `useReadyCatalog(server)` marks the import `ready` before each
  test (call it after `useTestClient`), and `requestRecording` sends
  `getRecording` and parses the answer with the contract's schema.
- Unit (`*.spec.ts` next to the file): pure logic only (env parsing, API key
  check, envelope parsing and error mapping, handlers, the dispatcher with its
  timeout, the heartbeat with fake timers, the worker loop, the logger).
  Services are tested with a mocked repository. Not unit-tested, covered by
  e2e: the entrypoints, `create-server.ts`, `ws/ws-server.ts`, repositories
  and the schema (the exclusions are in `vitest.config.ts`).
- The e2e suite has its own coverage thresholds
  (`vitest.config.e2e.ts`, report in `coverage-e2e/`). Both threshold sets
  and the Stryker `break` mirror the API's values; the maintainer is the only
  one who moves them.
