# notefinder

notefinder shows the exact vocal notes a singer hits in any song, on a timeline
synced with playback, with real-time pitch feedback from the user's mic.

This repo is a **from-scratch rewrite** of the original monolith
(<https://github.com/theryston/notefinder>, live at <https://notefinder.com.br>).
Goal: same features, split into a standalone API and a web client (a mobile app
comes later and will consume the same API), with a better-looking web UI.
When in doubt about a feature's behavior, check how the original does it.

App-specific rules live in `apps/web/CLAUDE.md` and `apps/api/CLAUDE.md`.

## Monorepo layout

```
apps/
  web/          Next.js 16 frontend (SSR, Cache Components, next-intl, shadcn/ui). Port 3000.
  api/          NestJS 12 REST API (Drizzle, Better Auth, BullMQ). Port 3333.
packages/
  contracts/    Zod schemas + inferred types shared by api, web and (later) mobile.
```

- Package manager: **nub** (`nub.lock`, pnpm-compatible). Never use npm/pnpm/yarn
  directly and never commit another lockfile. Node version is in `.node-version`.
- Task runner: **Turborepo** (`turbo.json`). Internal packages are referenced as
  `"@notefinder/<name>": "workspace:*"`.
- New shared code goes in `packages/<name>` only when at least two apps need it.

## Commands (from the root)

```sh
nub install                 # install everything
nub run infra:up            # start Postgres + Redis (docker compose)
nub run dev                 # build packages, then run web + api in watch mode
nub run lint                # biome check (lint + format + import order), all packages
nub run format              # biome check --write, all packages
nub run check-types         # tsc in every package
nub run test                # unit tests
nub run build               # production build of everything
nub run dev --filter=web    # scope any task to one package (web | api | @notefinder/contracts)
```

Before considering a change done, run `lint`, `check-types` and `test` for the
packages you touched (CI runs all four tasks on every PR).

## Compatibility with the legacy app (hard requirements)

The new app starts with an **empty database**, but it will replace the legacy
app in production. Two things must hold when that happens:

1. **Legacy data must be importable.** The new schema does not have to mirror
   the legacy Prisma schema, but a one-off script must be able to import all
   legacy data into it, even with transformations along the way. Never model
   something the legacy data can't be mapped into (see "Legacy data import"
   in `apps/api/CLAUDE.md`).
2. **No legacy URL may return 404.** Every public route of the legacy web app
   must either still exist or redirect to its new equivalent, keeping IDs and
   query params (see "Legacy routes" in
   `apps/web/CLAUDE.md`).

Both depend on **keeping legacy identifiers** (track, artist, album and user
IDs, usernames): the importer copies them as-is, so old URLs resolve to the
same records.

## Cross-cutting decisions

### Language

- **All code is in English**: identifiers, file names, comments, commit messages,
  log messages, API error messages, DB schema.
- **No hard-coded user-facing text.** Everything a user can read goes through
  i18n (web: `next-intl`; API returns stable error `code`s that clients
  translate). Locales: `en` and `pt-BR`. `en` is the **source of truth** for
  messages (keys are written there first), not the default for visitors: the
  locale is detected from the user's location/browser and falls back to `en`
  only when there is no match (details in `apps/web/CLAUDE.md`).

### Contracts (`packages/contracts`)

- Single source of truth for every request/response shape crossing the API
  boundary. Define the Zod schema there, export the inferred type next to it.
- The API validates input/output with these schemas; the web uses the same
  schemas for forms and types for fetchers. Never redeclare an API type in an app.
- Naming: `trackSchema` / `Track`, `createTrackBodySchema` / `CreateTrackBody`,
  `listTracksQuerySchema` / `ListTracksQuery`. One file per domain
  (`tracks.ts`, `users.ts`, …) re-exported from `src/index.ts` (the only barrel
  file allowed in the repo).
- Shared primitives already exist: `apiErrorSchema` (error envelope +
  `ApiErrorCode`), `cursorPaginationQuerySchema` and `cursorPageSchema(item)`.
- Web cache tag builders (e.g. `cacheTags.track(id)`) also live here, so the
  API invalidates exactly the tags the web caches with.
- It is a compiled package (`tsc` → `dist/`). Relative imports use the `.js`
  extension (NodeNext). Turbo builds it before `dev`, `check-types` and `test`.
- Changing an existing field is a breaking change for the mobile app: add new
  fields, deprecate old ones, and bump the API version for incompatible changes.

### TypeScript

- `tsconfig.base.json` is extended by every package: `strict`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`. Don't loosen it per package.
- No `any` (lint error). Use `unknown` + narrowing, generics or Zod parsing.
- No non-null assertions (`!`) to silence the compiler; handle the case.
- Prefer `type` over `interface` (use `interface` only when declaration merging
  is needed). No `enum` in TS: use `as const` objects or Zod enums.
- **Named exports only.** Default exports only where a framework requires them
  (Next `page`/`layout`/`loading`/`error`/`not-found`, config files).
- **No barrel files** (`index.ts` that re-exports) except `packages/*/src/index.ts`.
- File and folder names in **kebab-case** (enforced by Biome). Next's special
  files and Nest's `name.kind.ts` suffixes (`tracks.service.ts`) follow the same rule.
- Comments explain *why*, not *what*. No commented-out code.
- Dates cross the wire as ISO 8601 strings; use native `Date`/`Intl`, no moment.

### Lint & format: Biome only

- One `biome.json` at the root for everything (JS/TS/JSON/CSS). No ESLint,
  Prettier or oxlint.
- Style: 2 spaces, single quotes (double quotes in JSX attributes), semicolons,
  trailing commas, 80 columns, imports organized automatically.
- Promise safety rules on: `noFloatingPromises`, `noMisusedPromises`. Web adds
  Next/React domains and Tailwind class sorting (`useSortedClasses`, also inside
  `cn()`/`cva()`).
- Fix with `nub run format` (or `nub exec biome check --write <files>`). Don't
  disable a rule inline without a comment explaining why.

### Environment & infrastructure

- Every app validates `process.env` with a Zod schema at startup and fails fast
  (api: `src/config/env.ts`, web: `lib/env.ts`). Code reads config from that
  module, never from `process.env` directly.
- Every env var must be listed in the app's `.env.example` (with a safe local
  default when possible). Never commit real `.env` files or secrets.
- `docker-compose.yml` provides Postgres 17 and Redis 8 for local development
  (`nub run infra:up` / `infra:down`). E2E tests spin up their own throwaway
  containers (Testcontainers) instead of using the dev database.
- Production is self-hosted: one Docker image per app, published to GHCR by
  GitHub Actions and run on Coolify behind a CDN. Keep apps stateless so they
  can run with multiple instances (shared state lives in Postgres/Redis).

### Testing philosophy

- Pragmatic: test behavior that can break, not framework glue.
- API: unit tests for services (repositories mocked) + e2e tests per endpoint
  against a real Postgres.
- Web: Vitest for pure logic (timeline math, pitch detection, formatters) +
  Playwright for critical flows (search, track page, auth).
- **Every bug fix comes with a test that reproduces it.**

### Git workflow

- Branch from `main`, keep branches short-lived, merge via PR with green CI
  (lint, check-types, test, build). Squash merge.
- **Conventional Commits**, scoped by package:
  `<type>(<scope>): <subject>` with types `feat fix refactor perf test docs
  build ci chore style revert` and scopes `web api contracts repo`
  (e.g. `feat(api): add track search endpoint`). Enforced by lefthook.
- lefthook `pre-commit` runs Biome on staged files and re-stages the fixes.
  Don't bypass hooks with `--no-verify`.
- One logical change per PR; tooling/refactors separated from features.
