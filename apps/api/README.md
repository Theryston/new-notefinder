# notefinder API

NestJS REST API behind notefinder: tracks, vocal notes, artists, albums,
users and practice stats. It serves the web app and, later, the mobile app.
Every route lives under `/v1`.

## Running locally

From the repository root:

```sh
nub install
nub run infra:up             # Postgres + Redis via docker compose
cp apps/api/.env.example apps/api/.env
nub run dev --filter=api     # http://localhost:3333
```

Other tasks, scoped with `--filter=api`: `build`, `lint`, `check-types`,
`test`. E2E tests run from this folder with `nub run test:e2e` (needs Docker).

Environment variables are listed in [`.env.example`](./.env.example) and
validated at startup; the API refuses to boot with an invalid config.

## Contributing

Read the root [`CLAUDE.md`](../../CLAUDE.md) and this app's
[`CLAUDE.md`](./CLAUDE.md) for the architecture and coding standards.
