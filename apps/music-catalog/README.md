# notefinder Music catalog

Private service that will hold every Recording in the world (kept in sync with
MusicBrainz, plus open Lyrics) and answer searches over an authenticated
WebSocket. Today it is the skeleton: the WebSocket server answering `status`,
its Postgres schema and the worker entrypoint. Full design: issue #55.
Rules, layers and the protocol are in [`CLAUDE.md`](./CLAUDE.md).

## Running locally

From the repository root:

```sh
nub install
nub run infra:up                                   # Postgres on port 5433, with the rest of the stack
cp apps/music-catalog/.env.example apps/music-catalog/.env
(cd apps/music-catalog && nub run db:migrate)
nub run dev --filter=music-catalog                 # server on ws://localhost:3334, plus the worker
```

Try it with any WebSocket client, sending the key from `.env` in the handshake:

```sh
# for example: wscat -c ws://localhost:3334 -H "Authorization: Bearer <API_KEYS entry>"
> {"id":"1","type":"status","payload":{}}
< {"id":"1","ok":true,"result":{"phase":"restoring","dataset":"sample"}}
```

E2E tests run from this folder with `nub run test:e2e` (needs Docker).
Environment variables are listed in [`.env.example`](./.env.example) and
validated at startup; both processes refuse to boot with an invalid config.
