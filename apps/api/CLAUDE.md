# apps/api — NestJS REST API

Read the root `CLAUDE.md` first; this file only adds API-specific rules.

Stack: NestJS 12 (Express, **ESM**), Drizzle ORM + PostgreSQL, Better Auth,
BullMQ + Redis, Zod (via `@notefinder/contracts` + `nestjs-zod`), Vitest.
Serves the web app today and the mobile app later, so treat every endpoint as a
public, versioned contract.

## Commands

```sh
nub run dev          # nest start --watch (port from PORT, default 3333)
nub run test         # unit tests (*.spec.ts)
nub run test:e2e     # e2e tests (test/*.e2e-spec.ts, Testcontainers)
nub run check-types
nub run lint
```

Drizzle scripts (`db:generate`, `db:migrate`, `db:studio`) get added together
with the database module.

## Folder structure

```
src/
  main.ts                 bootstrap: versioning, global pipes/filters, swagger, shutdown hooks
  app.module.ts           wires config, database, infra modules and feature modules
  config/
    env.ts                Zod schema for process.env, parsed once at boot
  database/
    database.module.ts    Drizzle client provider (global)
    schema/               one file per table/aggregate (tracks.ts, users.ts, …) + index.ts
  common/                 cross-cutting Nest pieces only
    errors/               AppException + global exception filter
    guards/ decorators/ interceptors/ pipes/
  integrations/           clients for external services, one module each
    ytmusic/ s3/ sqs/ email/ openai/ …
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
  Services mark the unit of work with `@Transactional()`; repositories run
  queries through the `TransactionHost`, so Drizzle stays out of services.
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
- **Validation**: request DTOs are `createZodDto(schema)` from nestjs-zod, with
  the schema imported from `@notefinder/contracts`. Global `ZodValidationPipe`.
  Responses are serialized through their contract schema
  (`@ZodSerializerDto`) so no extra DB field ever leaks.
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
  production unless explicitly enabled).
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

## Auth (Better Auth)

- The Better Auth instance (Drizzle adapter, Google + email/password, email
  verification, password reset) lives in `modules/auth/`, with its handler
  mounted under `/v1/auth/*`. Its tables are part of the Drizzle schema.
- A global guard resolves the session from the request (cookie for web,
  bearer/Expo plugin for mobile). Routes are **private by default**; opt out
  with `@Public()`. Get the user with `@CurrentUser()`. Admin-only routes use
  `@Roles('admin')`.
- The web app calls the API from the server forwarding the incoming `cookie`
  header, and from the browser with `credentials: 'include'`; CORS allows only
  the configured web origin(s).

## Jobs, queues and cache (Redis)

- Background work uses `@nestjs/bullmq`. Queue names are constants in the owning
  module; consumers are `<feature>.processor.ts`. Job payloads are validated
  with Zod and jobs must be **idempotent** (they can be retried).
- Scheduled work (track score recalculation, daily practice reminders) uses
  BullMQ repeatable jobs, not in-process timers.
- The track import pipeline keeps its current contract: the API enqueues on
  **SQS** for the external note-detection worker, which reports back through
  `/v1/internal/*`.
- Redis also backs response caching of expensive reads and rate limiting
  (`@nestjs/throttler` with Redis storage). Cache keys are namespaced by feature.
- When data rendered by public web pages changes (a track finished processing,
  score updated, …), the API invalidates the web cache by calling the web
  revalidation endpoint with the affected tags. Tag builders are shared from
  `@notefinder/contracts` so both sides agree on names.

## Config, logging, lifecycle

- Read config only from `src/config/env.ts` (parsed with Zod at boot); inject
  it where needed. Never read `process.env` elsewhere.
- Use Nest's `Logger` (structured JSON logs in production). No `console.*`.
  Never log secrets, tokens, passwords or full request bodies.
- `enableShutdownHooks()` so queues and DB connections close cleanly on deploy.

## Testing

- Unit: `*.spec.ts` next to the file under test. Test services through
  `Test.createTestingModule`, overriding repositories and integrations with
  mocks. Don't unit-test controllers or repositories in isolation.
- E2E: `test/*.e2e-spec.ts`, one file per feature, hitting real HTTP routes
  (supertest) against a Postgres/Redis started with Testcontainers and migrated
  with the real migrations. Cover success, validation error, auth/permission
  and not-found for each endpoint.
- External services (SQS, S3, YT Music, email) are always mocked at the
  integration-module boundary.
