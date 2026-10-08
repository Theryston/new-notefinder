# notefinder Music catalog

Private service that holds every Recording in the world (kept in sync with
MusicBrainz, plus open Lyrics from LRCLIB) and answers searches over an
authenticated WebSocket: `status`, `getRecording` (everything known about one
Recording, by MBID) and `search` (free text over Meilisearch, results in its
relevance order, by metadata or by a line of Lyrics). Its worker restores and
indexes the data and keeps it in sync. Full design: issue #55.
Rules, layers, the protocol and the operations guide are in
[`CLAUDE.md`](./CLAUDE.md).

## Running locally

From the repository root:

```sh
nub install
cp apps/music-catalog/.env.example apps/music-catalog/.env
(cd apps/music-catalog && nub run db:migrate)
nub run build --filter=music-catalog              # the mbslave container runs this dist
nub run infra:up                                   # Postgres (5433) and Meilisearch (7700), with the rest of the stack,
                                                   # plus a one-shot mbslave container that seeds the `tiny` dataset
nub run dev --filter=music-catalog                 # server on ws://localhost:3334, plus the worker
```

The `tiny` dataset (about a hundred real MusicBrainz Recordings on ten albums,
no download) is seeded in seconds the first time; `status` follows it (`restoring` → `restored` →
`indexing` → `ready`), and `search` answers once it is `ready`. Bootstrap
phases, dataset modes and resetting a local database are documented in
[`CLAUDE.md`](./CLAUDE.md).

Try it with any WebSocket client, sending the key from `.env` in the handshake:

```sh
# for example: wscat -c ws://localhost:3334 -H "Authorization: Bearer <API_KEYS entry>"
> {"id":"1","type":"status","payload":{}}
< {"id":"1","ok":true,"result":{"phase":"restoring","dataset":"tiny"}}
```

E2E tests run from this folder with `nub run test:e2e` (needs Docker).
Environment variables are listed in [`.env.example`](./.env.example) and
validated at startup; both processes refuse to boot with an invalid config.

## Deploying

The production stack lives in [`deploy/`](./deploy): one compose file with
Caddy (automatic HTTPS), the server, the worker, mbslave, Postgres and
Meilisearch, running the images CI publishes to GHCR. On the server:
`docker compose pull && docker compose up -d`. Provisioning, the first run,
updates, key rotation, backups and troubleshooting are in
[`CLAUDE.md`](./CLAUDE.md), "Operations (production)".
