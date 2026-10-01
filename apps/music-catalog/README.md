# notefinder Music catalog

Private service that will hold every Recording in the world (kept in sync with
MusicBrainz, plus open Lyrics) and answer searches over an authenticated
WebSocket. Today: the WebSocket server answering `status`, `getRecording`
(everything known about one Recording, by MBID) and `search` (free text over
Meilisearch, results in its relevance order), its Postgres schema and the
worker, which indexes the Recordings once MusicBrainz is restored. Full
design: issue #55.
Rules, layers and the protocol are in [`CLAUDE.md`](./CLAUDE.md).

## Running locally

From the repository root:

```sh
nub install
cp apps/music-catalog/.env.example apps/music-catalog/.env
(cd apps/music-catalog && nub run db:migrate)      # apply the service schema before restore
nub run infra:up                                   # includes the sample MusicBrainz restore
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
the Node process settings are validated at startup; both processes refuse to
boot with an invalid config. The mbslave container uses the restore settings
from the same file. Use `CATALOG_DATASET=sample` for local development;
`full` downloads the official full core and derived archives.

The restore runs once per database. It skips a completed restore, including
when the configured dataset later changes. To start over locally, stop the
stack and remove only the Music catalog Postgres volume, then migrate and
start it again:

```sh
nub run infra:down
docker volume rm notefinder_music-catalog-postgres-data
(cd apps/music-catalog && nub run db:migrate)
nub run infra:up
```
