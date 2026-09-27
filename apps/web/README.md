# notefinder web

Next.js web client for notefinder: search a song, see the exact vocal notes on
a timeline synced with playback and get real-time pitch feedback from your
mic. All data comes from the notefinder API (`apps/api`).

## Running locally

From the repository root:

```sh
nub install
cp apps/web/.env.example apps/web/.env
nub run infra:up             # Postgres + Redis, needed by the API
nub run dev                  # web (http://localhost:3000) + API (:3333)
nub run dev --filter=web     # web only, against an API already running
```

Other tasks, scoped with `--filter=web`: `build`, `lint`, `check-types`,
`test`.

Environment variables are listed in [`.env.example`](./.env.example) and
validated at startup.

## Contributing

Read the root [`CLAUDE.md`](../../CLAUDE.md) and this app's
[`CLAUDE.md`](./CLAUDE.md) for the architecture and coding standards.
