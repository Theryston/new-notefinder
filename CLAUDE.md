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
nub run infra:up            # start Postgres + API Redis + web cache Redis (docker compose)
nub run dev                 # build packages, then run web + api in watch mode
nub run lint                # biome check (lint + format + import order), all packages
nub run knip                # unused files, exports and dependencies (whole repo)
nub run duplication         # jscpd: fails above 3% duplicated code (whole repo)
nub run format              # biome check --write, all packages
nub run check-types         # tsc in every package
nub run test                # unit tests
nub run test:cov            # unit tests + coverage thresholds (what CI runs)
nub run test:mutation --filter=api   # Stryker mutation tests (per app: api | web)
nub run test:e2e            # API e2e (Testcontainers Postgres) + web Playwright
nub run build               # production build of everything
nub run dev --filter=web    # scope any task to one package (web | api | @notefinder/contracts)
```

Before considering a change done, run `lint`, `check-types` and `test:cov` for
the packages you touched, plus `knip` and `duplication` (CI runs lint,
check-types, test:cov, build, knip and duplication on every PR).

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

### Design

`DESIGN.md` is the design system (direction, color, type, shape, elevation,
motion, icons, the note timeline). Every UI change follows it, and changing a
design token means updating `DESIGN.md` and the tokens in
`apps/web/app/globals.css` together.

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
- **No barrel files** (`index.ts` that re-exports) except `packages/*/src/index.ts`
  and the Drizzle schema index.
- All of the above are lint errors. The framework files allowed a default
  export (and the allowed barrels) are listed in the `biome.json` overrides:
  add a new framework file there rather than silencing the rule inline.
  Declaration merging (`interface` augmenting a library) takes a
  `biome-ignore` with the reason.
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
  (api: `src/config/env.ts`, web: `lib/env/server.ts` + `lib/env/client.ts`). Code reads config from that
  module, never from `process.env` directly (`noProcessEnv`; only the env
  modules, config files and test setup are exempt in `biome.json`).
- Every env var must be listed in the app's `.env.example` (with a safe local
  default when possible). Never commit real `.env` files or secrets.
- `docker-compose.yml` provides Postgres 17 and the API's Redis 8 (6379) for
  local development, and includes `apps/web/docker-compose.yml` (`web-redis`
  on 6380, the web's shared cache); `nub run infra:up` / `infra:down` start
  and stop all of them. E2E tests spin up their own throwaway
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

### Code quality metrics (enforced by CI)

- **Unit test coverage**: each app's `vitest.config.ts` sets
  `coverage.thresholds` (lines, branches, functions, statements) and
  `nub run test:cov` fails below them. They are a ratchet, set to the current
  coverage rounded down: **never lower a threshold** (that counts as weakening
  a test, see below); when a PR raises coverage, raise the thresholds to the
  new floor in the same PR. Code covered by e2e instead of unit tests (API
  controllers, repositories, modules and schema; web `.tsx` components) is
  excluded from the measurement in the config, so add new unit-testable code
  under a measured path. The API e2e suite has its own thresholds (in
  `apps/api/vitest.config.e2e.ts`, report in `coverage-e2e/`), which cover
  those controllers and repositories; same ratchet rule.
- **Mutation score**: coverage says a line ran, not that a test would notice
  it breaking. Stryker (`nub run test:mutation`, `stryker.config.json` per
  app, its own workflow in CI) changes the unit-tested code (flips
  conditions, removes calls, …) and fails when fewer mutants than
  `thresholds.break` are killed (api 58%, web 66%). Same ratchet as coverage:
  never lower it, raise it when a PR improves the score. A surviving mutant
  in code you touched usually means a missing assertion; the HTML report is
  in `reports/mutation/`.
- **Cognitive complexity**: at most 15 per function
  (`noExcessiveCognitiveComplexity` in `biome.json`). Over the limit, split the
  function (extract helpers, return early, name compound conditions); never
  silence the rule with `biome-ignore` or raise the limit.
- **Size**: at most 300 lines per file (500 in test files), 50 lines per
  function and 4 parameters per function, blank lines not counted
  (`noExcessiveLinesPerFile`, `noExcessiveLinesPerFunction`, `useMaxParams`;
  test files are exempt from the function limit, since `describe` blocks
  are long by nature). Over a limit, split by responsibility (a module per
  concern, a helper per step, an options object instead of positional
  params). A `biome-ignore` is only for what the code can't change (a
  signature imposed by a library interface, a fixture file) and says why.
- **Architecture**: `nub run lint` also runs dependency-cruiser with each
  app's `.dependency-cruiser.cjs`, which encodes the layer and module rules
  of that app's CLAUDE.md (no import cycles; API: only repositories touch
  Drizzle, modules talk through their service; web: shared code never imports
  features, features use each other only through `components/`). Change the
  code, not the rule; a new rule or exception goes in that file with a
  `comment` saying why.

### Dead code (enforced by CI)

- `nub run knip` fails on unused files, exports and dependencies. Delete dead
  code rather than exporting "for later"; export only what another module
  imports. Files the framework loads by convention and documented entry points
  not used yet are listed in `knip.config.ts` with the reason; remove an entry
  from its ignore lists as soon as the code is used.

### Duplication (enforced by CI)

- `nub run duplication` (jscpd, `.jscpd.json`) fails when duplicated code
  (clones of 50+ tokens) exceeds 3% of the codebase; today it is ~0.2%. It
  lists every clone: extract the shared part (a helper, a factory, a table
  of cases) instead of copying it. Don't raise the threshold.

### Tests are the safety net (rules for everyone, including AI agents)

- **Everything new ships with tests in the same PR.** A new endpoint, service
  method, job, component logic, route, migration-dependent behavior or legacy
  route is not done until tests cover it (unit and/or e2e, per the app's
  CLAUDE.md). A PR that adds behavior without tests is incomplete.
- **When a test fails, fix the code, not the test.** A failing test means
  something that used to work broke. Find the root cause in the code and fix
  it. Never make CI green by editing, weakening, skipping (`.skip`,
  `.fixme`, `.todo`), deleting or loosening the assertions of an
  existing test, or by adding retries/timeouts to hide a real failure.
  `.skip`/`.only` are lint errors (`noSkippedTests`, `noFocusedTests`).
- The **only** reason to change an existing test is an intentional behavior
  change that the user explicitly asked for. Then change the test in the same
  PR as the behavior, and say in the PR description which test changed and
  why.
- If a test looks wrong (flaky, testing the wrong thing), don't silently
  "fix" it: stop and raise it with the user, explaining the evidence.

### Git workflow

- Branch from `main`, keep branches short-lived, merge via PR with green CI
  (lint, check-types, test, build). Squash merge.
- **Conventional Commits**, scoped by package:
  `<type>(<scope>): <subject>` with types `feat fix refactor perf test docs
  build ci chore style revert` and scopes `web api contracts repo`
  (e.g. `feat(api): add track search endpoint`). Enforced by lefthook
  on commits and by CI on the PR title (it becomes the squash commit).
- lefthook `pre-commit` runs Biome on staged files and re-stages the fixes.
  Don't bypass hooks with `--no-verify`.
- One logical change per PR; tooling/refactors separated from features.
