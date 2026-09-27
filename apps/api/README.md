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
(cd apps/api && nub run db:migrate && nub run db:seed)
nub run dev --filter=api     # http://localhost:3333
```

## Database

Drizzle ORM on Postgres. Run these from `apps/api`:

- `nub run db:generate` creates a migration in `drizzle/` from changes in
  `src/database/schema/` (review the SQL and commit it).
- `nub run db:migrate` applies pending migrations. It is an explicit step,
  never run on boot; production runs `node dist/database/migrate.js` (the
  image needs the `drizzle/` folder).
- `nub run db:seed` upserts a small fictional catalog with synthetic vocal
  notes, created by a user you can sign in as (`seed@notefinder.dev` /
  `notefinder-seed`). Deterministic and safe to re-run; refuses
  `NODE_ENV=production`.
- `nub run db:studio` opens Drizzle Studio.

Other tasks, scoped with `--filter=api`: `build`, `lint`, `check-types`,
`test`. E2E tests run from this folder with `nub run test:e2e` (needs Docker).

Environment variables are listed in [`.env.example`](./.env.example) and
validated at startup; the API refuses to boot with an invalid config.

## Auth

[Better Auth](https://better-auth.com) serves `/v1/auth/*` (sign up/in/out,
Google, email verification and password reset with 6-digit codes,
usernames); its responses use Better Auth's own format, which the Better
Auth client expects. Every other route is private unless marked
`@Public()`, and `GET /v1/me` returns the signed-in user. Without
`RESEND_API_KEY`, emails (and their codes) are printed to the API logs.

## Contributing

Read the root [`CLAUDE.md`](../../CLAUDE.md) and this app's
[`CLAUDE.md`](./CLAUDE.md) for the architecture and coding standards.
