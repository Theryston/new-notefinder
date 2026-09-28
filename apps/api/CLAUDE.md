# apps/api — NestJS REST API

Read the root `CLAUDE.md` first; this file only adds API-specific rules.

Stack: NestJS 12 (Express, **ESM**), Drizzle ORM + PostgreSQL, Better Auth,
BullMQ + Redis, Zod (via `@notefinder/contracts` + the in-house `src/common/zod/`), Vitest.
Serves the web app today and the mobile app later, so treat every endpoint as a
public, versioned contract.

## Commands

```sh
nub run dev          # nest start --watch (port from PORT, default 3333)
nub run test         # unit tests (*.spec.ts)
nub run test:cov     # unit tests + coverage thresholds (report in coverage/)
nub run test:e2e     # e2e tests (test/*.e2e-spec.ts) against a Testcontainers Postgres
                     # (needs Docker, or E2E_DATABASE_URL — see Testing)
nub run check-types
nub run lint
```

Database scripts (need a valid `apps/api/.env`, i.e. `DATABASE_URL` and
`REDIS_URL`, since they read the same env schema):

```sh
nub run db:generate  # drizzle-kit: schema diff → new SQL migration in drizzle/
nub run db:migrate   # apply migrations (dev); production runs
                     # `node dist/database/migrate.js`, so the image ships drizzle/
nub run db:studio    # Drizzle Studio
nub run db:seed      # deterministic, idempotent dev data; refuses NODE_ENV=production
                     # (sign in as seed@notefinder.dev / notefinder-seed)
```

These scripts run through `tsx`, which does **not** emit decorator metadata:
never bootstrap Nest DI from a `tsx` script (constructor injection by type
resolves to `undefined`). Vitest and `nest build` are not affected.

## Folder structure

```
src/
  main.ts                 bootstrap: versioning, global pipes/filters, swagger, shutdown hooks
  app.module.ts           wires config, database, infra modules and feature modules
  config/
    env.ts                Zod schema for process.env, parsed once at boot
  database/
    database.module.ts    Drizzle client (global) + nestjs-cls transactions
    columns.ts            id() and timestamps helpers used by every table
    schema/               one file per table/aggregate + relations.ts + index.ts
    migrate.ts seed.ts    scripts behind db:migrate / db:seed
  redis/                  shared ioredis client (REDIS_CLIENT), CacheService, redisKey()
  queue/                  BullMQ root config, AppWorker (clean shutdown, Nest logging)
  common/                 cross-cutting Nest pieces only
    errors/               AppException + global exception filter
    zod/                  createZodDto, ZodValidationPipe, @ZodSerializerDto
    rate-limit/           global throttler guard + Redis storage
    guards/ decorators/ interceptors/ pipes/
  integrations/           clients for external services, one module each
    web-revalidation/     enqueue + POST cache tags to the web's /api/revalidate
    email/                EmailService (Resend) + OTP templates (en, pt-BR), sent via a job
    ytmusic/ s3/ sqs/ openai/ …
  modules/                one folder per feature (domain)
    tracks/
      tracks.module.ts
      tracks.controller.ts
      tracks.service.ts
      tracks.repository.ts
      tracks.processor.ts     (BullMQ consumer, when the feature has jobs)
      tracks.service.spec.ts
    users/ auth/ artists/ albums/ streaks/ stats/ …
drizzle/                  generated SQL migrations (committed)
test/                     e2e specs + helpers (app factory, Testcontainers setup)
```

- A feature module owns its controller, service, repository, processors and
  tests. Other modules use it only through its **exported service**, never its
  repository or tables directly.
- `common/` holds only framework-level, domain-agnostic code. Domain helpers
  stay inside their module.
- `integrations/` wrap third-party SDKs behind a small typed service, so
  features never import an SDK directly (and tests can mock one provider).

## Layers (controller → service → repository)

- **Controller**: HTTP only. Declares route, version, guards, and DTOs;
  validates input; calls one service method; returns a contract-shaped object.
  No business rules, no Drizzle.
- **Service**: business rules and orchestration (repositories, other services,
  integrations, queues). No `Request`/`Response` objects, no Drizzle queries.
  Throws `AppException` for expected failures.
- **Repository**: the only layer that imports Drizzle and the schema. Returns
  plain typed objects (never leaks query builders). One repository per
  aggregate, named `<Feature>Repository`.
- Transactions: use `@nestjs-cls/transactional` with the Drizzle adapter.
  Services mark the unit of work with `@Transactional()`; repositories inject
  `TransactionHost<DatabaseAdapter>` and query through `txHost.tx`, so Drizzle
  stays out of services and repository calls join the current transaction.
- Dependency injection: import injected classes as **values**, not
  `import type` (decorator metadata needs the runtime reference). Biome's
  `useImportType` is disabled for this app for that reason.

## ESM details

- `"type": "module"` + `nodenext`: relative imports **must** end in `.js`
  (`import { TracksService } from './tracks.service.js'`).
- Top-level `await` is fine (see `main.ts`). No `require`, no `__dirname`
  (use `import.meta.dirname`).

## HTTP conventions

- URI versioning: every route lives under `/v1` (`app.enableVersioning` with
  `defaultVersion: '1'`). Breaking changes go to `/v2` for the affected routes;
  old versions keep working until the mobile app has migrated.
- Resources are plural, kebab-case nouns; nesting at most one level:
  `GET /v1/tracks/:trackId/notes`, `POST /v1/tracks`, `DELETE /v1/me/favorites/:trackId`.
  The authenticated user's own resources live under `/v1/me/...`.
- JSON bodies and query params in **camelCase**. Dates as ISO 8601 strings.
- Status codes: `200` read/update, `201` create (return the resource), `204`
  delete/no body, `202` accepted async work (e.g. track import queued).
- **Validation**: request DTOs are `createZodDto(schema)` from
  `src/common/zod/`, with the schema imported from `@notefinder/contracts`.
  The global `ZodValidationPipe` parses and coerces them. Responses are
  serialized through their contract schema (`@ZodSerializerDto`) so no extra
  DB field ever leaks. (`nestjs-zod` is not used: it doesn't support NestJS
  12; `src/common/zod/` mirrors its API. OpenAPI covers request shapes only.)
- Validation failures return **400** `VALIDATION_FAILED` with
  `details: { location: 'body' | 'query' | 'param' | 'custom', issues }`.
- **Lists** use cursor pagination: query `cursorPaginationQuerySchema`,
  response `cursorPageSchema(item)` → `{ items, nextCursor }`. Cursors are
  opaque strings (base64 of the sort key), never raw offsets.
- **Errors**: always the `apiErrorSchema` envelope
  `{ statusCode, code, message, details? }`. Throw
  `new AppException('NOT_FOUND', 'Track not found')`; the global filter maps
  it (and Zod/Nest/unknown errors) to the envelope. `code` comes from
  `ApiErrorCode` in contracts and is what clients translate; `message` is an
  English developer message, never shown as-is to users. Add new codes to the
  contracts enum; never rename existing ones.
- OpenAPI: generated from the Zod DTOs and served at `/docs` (disabled in
  production unless explicitly enabled). The document is committed as
  `openapi.json`: `test/openapi.e2e-spec.ts` fails when it is out of date
  (after an intentional change, run `nub run test:e2e -- -u` and commit it),
  and CI runs `oasdiff breaking` against the base branch's copy, so removing
  a route or a field, or making a param required, fails the PR. Breaking
  changes go to a new version (`/v2`) instead.
- Internal endpoints called by the external note-detection worker live under
  `/v1/internal/*` and are protected by an API-key guard, not user auth.

## Database (Drizzle + Postgres)

- Schema in `src/database/schema/*.ts`. Tables and columns are **snake_case**
  in SQL (`casing: 'snake_case'`), camelCase in TypeScript; table names plural
  (`tracks`, `track_notes`).
- Every table has `id` (text, cuid2 generated in app, compatible with the
  original data), `createdAt` and `updatedAt` (`timestamp with time zone`).
- Declare foreign keys with explicit `onDelete`, and add indexes for every
  column used in `where`/`order by` of hot queries (look at the original
  Prisma schema for relations to preserve).
- Migrations: change the schema → `db:generate` → review the SQL → commit it in
  `drizzle/`. Never edit a migration that was already applied, never use
  `drizzle-kit push` outside a throwaway local database.
- Use the relational query API for reads with relations and the SQL-like
  builder for everything else. Select only the columns you need. No raw SQL
  strings with interpolated values; use the `sql` template tag.

### Legacy data import

Development starts with an empty database, but at launch all data from the
legacy database (schema: `prisma/schema.prisma` in
<https://github.com/theryston/notefinder>) will be imported by a one-off
script (`src/scripts/import-legacy.ts`, written at the end of the project).
The new schema may differ, but every schema change must keep that import
possible:

- **Every legacy entity and field has a destination** (or a documented
  reason to drop it): users, OAuth accounts, tracks, track notes, artists,
  albums, thumbnails, views, favorites, section visibility, daily practice
  streaks, calculation jobs, etc.
- **Keep legacy IDs** (cuid strings) as the primary keys of imported rows, so
  old URLs and references still resolve. New rows use cuid2, which fits the
  same `text` column.
- **Password hashes are bcrypt** in the legacy DB; the Better Auth password
  config must verify bcrypt hashes (or rehash on next login), so users don't
  need to reset passwords. Google accounts map via `provider` +
  `providerAccountId`.
- Don't add `NOT NULL` columns or constraints the legacy data can't satisfy
  without a clear default/transformation (legacy has many nullable fields,
  e.g. `Track.title`, `Track.duration`).
- Enum values may be renamed, but keep a 1:1 (or clearly derivable) mapping
  from the legacy values (`TrackStatus`, `PlayingCopyright`, `Role`, …).
- Files referenced by URL (S3 thumbnails, audio, lyrics, avatars) keep
  working with the existing URLs or have a deterministic mapping.
- When a schema change diverges from the legacy model, write the mapping in
  the PR description (and in a comment next to the table if it isn't
  obvious), so the import script can be written from those notes.

## Auth (Better Auth)

- The Better Auth instance (`modules/auth/auth.ts`: Drizzle adapter,
  email/password, `emailOTP` for email verification and password reset with
  6-digit codes, `username`, Google when `GOOGLE_CLIENT_ID`/`SECRET` are set)
  owns the `users`, `sessions`, `accounts` and `verifications` tables.
  Verification is required before a session exists.
- `/v1/auth/*` is a **raw Express handler** registered in `configureApp`, not
  a Nest route: it uses Better Auth's own response format (the one exception
  to the error envelope, because the Better Auth clients expect it) and its
  own Redis-backed rate limiter, since Nest guards/pipes don't run there.
  Everything else goes through Nest.
- A global `AuthGuard` resolves the session from the cookie. Routes are
  **private by default**: every public route (health, public catalog pages,
  test probe controllers) needs `@Public()`. Read the user with
  `@CurrentUser()` (set on `request.user`). Admin-only routes use
  `@Roles('ADMIN')` (legacy enum values). Guard order: throttler → auth →
  roles. Mobile (bearer/Expo plugin) is not wired yet.
- Passwords: new ones are scrypt (Better Auth default); legacy bcrypt hashes
  are accepted and rehashed to scrypt on the next successful sign-in
  (`modules/auth/password.ts`). `role` and `dailyPracticeTargetSeconds` can't
  be set by users (`input: false`).
- Emails (OTP codes) go through `EmailService`/the email job with templates
  in en and pt-BR chosen from `Accept-Language`; without `RESEND_API_KEY`
  (outside production) they are logged, so codes show in the dev console.
- The web app calls the API from the server forwarding the incoming `cookie`
  header, and from the browser with `credentials: 'include'`; CORS and
  Better Auth's `trustedOrigins` allow only `WEB_ORIGINS`.
- **Production env**: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `RESEND_API_KEY` (required, so codes are never silently lost) and
  `AUTH_COOKIE_DOMAIN=notefinder.com.br` (the API is on a subdomain; without
  it the web server never receives the session cookie).

## Jobs, queues and cache (Redis)

- Background work uses `@nestjs/bullmq`. Queue name, job name and the Zod
  payload schema live in `<feature>.job.ts` (a separate file avoids an import
  cycle between module and processor); consumers are `<feature>.processor.ts`.
  Jobs must be **idempotent** (they are retried with exponential backoff).
  Throw `UnrecoverableError` for failures that retrying can't fix.
- Every new queue and processor must be added to
  `test/redis-test-overrides.ts`, so e2e tests keep running without Redis.
- Scheduled work (track score recalculation, daily practice reminders) uses
  BullMQ repeatable jobs, not in-process timers.
- The track import pipeline keeps its current contract: the API enqueues on
  **SQS** for the external note-detection worker, which reports back through
  `/v1/internal/*`.
- Redis also backs response caching of expensive reads (`CacheService`, keys
  built with `redisKey(feature, …)`) and rate limiting (`@nestjs/throttler`
  with the in-house `RedisThrottlerStorage`; `@nest-lab/throttler-storage-redis`
  doesn't support NestJS 12). Both fail open: Redis being down degrades to
  cache misses / no limiting instead of errors.
- When data rendered by public web pages changes (a track finished processing,
  score updated, …), call `WebRevalidationService.revalidate(tags)` with tags
  from `cacheTags` in `@notefinder/contracts` (never hard-coded strings). It
  enqueues a job that POSTs them to the web's `/api/revalidate`.

## Config, logging, lifecycle

- Read config only from `src/config/env.ts` (parsed with Zod at boot); inject
  it with `@Inject(ENV) env: Env`. `apps/api/.env` is loaded automatically
  outside test/production. Never read `process.env` elsewhere.
- Global HTTP setup (versioning, CORS, pipes, filters, Swagger) lives in
  `src/setup-app.ts` `configureApp(app)`, shared by `main.ts` and the e2e
  tests. Add global behavior there, never only in `main.ts`.
- Use Nest's `Logger` (structured JSON logs in production). No `console.*`.
  Never log secrets, tokens, passwords or full request bodies.
- `enableShutdownHooks()` so queues and DB connections close cleanly on deploy.
- Health: `GET /v1/health` is liveness (never touches dependencies) and
  `GET /v1/health/ready` is readiness (Postgres + Redis, 503 when one fails).
  Point the container healthcheck at liveness and traffic routing at readiness.
- **Deployment**: behind a CDN/reverse proxy, set `TRUST_PROXY` to the number
  of proxies between the client and the API (e.g. `2` for CDN → Traefik →
  API) or their address ranges. Otherwise `req.ip` is the proxy's address and
  every visitor shares one rate-limit bucket.

## Testing

- Unit: `*.spec.ts` next to the file under test. Test services through
  `Test.createTestingModule`, overriding repositories and integrations with
  mocks. Don't unit-test controllers or repositories in isolation.
- E2E: `test/*.e2e-spec.ts`, one file per feature, hitting real HTTP routes
  (supertest). Cover success, validation error, auth/permission and
  not-found for each endpoint.
  - Database: one Postgres 17 container per run (Testcontainers), migrated
    with the real migrations. Without Docker, set `E2E_DATABASE_URL` to a
    Postgres **dedicated to tests**: it is migrated and every table in it is
    truncated.
  - Boot the app with `createTestApp({ controllers?, env?, override? })` from
    `test/utils/create-test-app.ts` → `{ app, http, db, queues, close }`. It
    applies `configureApp` and replaces Redis-backed providers
    (`test/redis-test-overrides.ts`), so e2e tests don't need Redis;
    `override` runs last, to mock integrations.
  - Specs that write call `resetDatabase(db)` in `beforeEach` and seed with
    the typed factories in `test/utils/factories.ts` (add one per new table).
    DB-only specs can use `connectTestDatabase()`.
  - Files run sequentially against one shared database
    (`fileParallelism: false`); tests must not depend on order.
  - Test-only controllers live in separate non-spec files under `test/` and
    need `@Public()` unless they test auth.
- External services (SQS, S3, YT Music, email) are always mocked at the
  integration-module boundary.
