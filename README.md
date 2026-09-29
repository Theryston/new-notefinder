# notefinder

Rewrite of [notefinder](https://github.com/theryston/notefinder) with a
standalone API and web frontend. Monorepo managed with
[Turborepo](https://turborepo.dev) and [nub](https://nubjs.com).

## Structure

- `apps/web`: [Next.js](https://nextjs.org) frontend with
  [shadcn/ui](https://ui.shadcn.com). Port 3000.
- `apps/api`: [NestJS](https://nestjs.com) API. Port 3333 (`PORT`).
- `packages/contracts`: Zod schemas and types shared by the API, the web app
  and (later) the mobile app.

Code standards, architecture and tooling are documented in `CLAUDE.md` (root)
and `apps/*/CLAUDE.md`.

## Commands

```sh
nub install          # install dependencies (and lefthook git hooks)
nub run infra:up     # start Postgres, Redis and MinIO (S3) with docker compose
nub run dev          # run web and api
nub run build        # build everything
nub run lint         # Biome (lint + format + imports)
nub run format       # Biome with --write
nub run check-types
nub run test
nub run test:cov     # unit tests + coverage thresholds (what CI runs)
```

To run a single app: `nub run dev --filter=web` (or `api`).

Copy `apps/api/.env.example` and `apps/web/.env.example` to `.env` in each app.

## Editor setup

Biome is the only formatter/linter. Project settings are included for
VS Code (`.vscode/`) and Zed (`.zed/`); install the Biome extension in your
editor.
