# apps/music-catalog: Music catalog service

Read the root `CLAUDE.md` first; this file only adds this app's rules.

The **Music catalog** is a private, autonomous service that will hold every
**Recording** in the world (kept in sync with MusicBrainz, plus open
**Lyrics**), searchable in milliseconds. Internal clients (the API today,
others later) talk to it over one long-lived, authenticated **WebSocket**.
The full design is in the parent spec, issue #55; this file documents what
exists.

**What exists today** (the skeleton, issue #57): the authenticated WebSocket
server answering `status`, the protocol envelope, our own Postgres schema
(the bootstrap state), the `server` and `worker` entrypoints (the worker is a
no-op loop) and the test and quality setup. Search, Get by id, the MusicBrainz
restore and bootstrap, the search engine, replication, Lyrics and the
production compose are later tickets: do not build them here ahead of their
ticket. The **search engine is still to be chosen** (a benchmark of tuned
Sonic, Meilisearch and Postgres full-text search, issue #68); whatever it is,
`search` will return results in the engine's relevance order, loaded from
Postgres without re-ranking.

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
  database/
    database.ts           pg pool + Drizzle client
    schema/               one file per table (music-catalog-schema.ts holds the pgSchema)
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
  worker/worker-loop.ts   the loop the worker's steps plug into
drizzle/                  generated SQL migrations (committed)
test/                     e2e specs + helpers (test server, ws client, Testcontainers setup)
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

## Protocol (`@notefinder/contracts`, `music-catalog.ts`)

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
failure   { id, ok: false, error: { code, message } }
```

- `id` is chosen by the client (1 to 128 characters) and echoed by the
  response that answers it. Every message is handled on its own, so many
  requests can be in flight on one connection and responses may arrive in any
  order: match them by `id`. `id` is `null` in a failure only when the
  message was too broken to read one from it.
- `type` is `status` today (`search` and `getRecording` come later). `payload`
  is validated per type; `status` takes none (missing or `{}`).
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
  `message` is an English developer message. Anything a handler throws that
  is not a `CatalogError` is answered `INTERNAL` with the fixed message
  "Internal error" and logged; its own message never reaches the client.
- A malformed message or an unknown type never closes the connection.
- **Heartbeat**: the server pings every `HEARTBEAT_INTERVAL_MS`; a connection
  that did not pong since the previous ping is terminated (so a dead peer is
  dropped within two intervals). Clients need no code for it: WebSocket
  libraries answer pings by themselves. Clients should reconnect when a
  connection drops (the server also closes with 1001 when it shuts down).
- **Request timeout**: a request still unanswered after `REQUEST_TIMEOUT_MS`
  gets `INTERNAL` ("Request timed out"). The handler keeps running (a promise
  can't be cancelled), so handlers must be safe to finish late.
- Changing a field of a result is a breaking change for consumers: add
  fields, don't rename or remove them (same rule as the API's contracts).
  A new operation adds its type to `musicCatalogRequestTypeSchema` and its
  payload/result schemas to contracts, a handler in its module and a line in
  `create-server.ts`.

## Database (Drizzle + Postgres)

- Our own tables live in the dedicated Postgres schema **`music_catalog`**
  (`src/database/schema/music-catalog-schema.ts`), managed by drizzle-kit
  migrations in `drizzle/` (committed; the migrations table is drizzle's
  default `drizzle.__drizzle_migrations`). The MusicBrainz tables that later
  tickets read belong to mbslave: they are declared by hand as read-only
  Drizzle tables and **never migrated here** (`schemaFilter` in
  `drizzle.config.ts` keeps drizzle-kit out of them).
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
