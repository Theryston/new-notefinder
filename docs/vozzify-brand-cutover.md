# Vozzify brand and domain cutover

The rewrite is now Vozzify at `https://vozzify.com`. The original
`Theryston/notefinder` repository and `notefinder.com.br` remain references
to the legacy monolith. This change updates repository configuration; it
does not rename running services, transfer objects or delete existing data.

## Application configuration

For production, configure the web build with
`NEXT_PUBLIC_SITE_URL=https://vozzify.com` and
`NEXT_PUBLIC_API_URL=https://api.vozzify.com`. At runtime, set the web's
`API_URL` to the API's reachable address. Configure the API with:

```dotenv
WEB_URL=https://vozzify.com
WEB_ORIGINS=https://vozzify.com
BETTER_AUTH_URL=https://api.vozzify.com
AUTH_COOKIE_DOMAIN=vozzify.com
EMAIL_FROM=vozzify <noreply@vozzify.com>
S3_PUBLIC_URL=https://files.vozzify.com
```

The apex domain is verified in Resend. Configure DNS/TLS for the API and
files subdomains before using those addresses, and update Google's allowed
origins and OAuth callback to
`https://api.vozzify.com/v1/auth/callback/google`. Existing deployment
environment values override the new defaults and must be updated separately.

Keep the legacy site's public paths and query parameters working when
redirecting its domain to Vozzify. Catalog IDs still resolve through the
legacy ID maps; a brand rename does not replace that import process.

## Existing browser state

The new application writes `vozzify` cookies and browser-storage keys.
Cookies and local/session storage from `notefinder.com.br` are not readable
on `vozzify.com`: visitors sign in on the new domain and device preferences
start with defaults there. Their accounts and server-side user data remain
in the database or the legacy user import; no account record is deleted.
Retain old-origin storage if a separate user-assisted transfer is needed.

For an existing installation on the same origin, copy the old application's
storage keys to their new `vozzify` names before switching versions if its
device preferences or pending practice runs must be retained. Keep the old
keys until the rollback window closes. Do not run old and new clients
against different session/queue namespaces during the cutover.

## Queues, databases, volumes and files

- Pause incoming work and drain pending, delayed and retrying BullMQ jobs
  before changing the queue prefix from `notefinder:bull` to `vozzify:bull`.
  If draining is not possible, retain the old workers and resources until
  their jobs finish; do not delete the old namespace. Deploy all producers
  and workers together. Other Redis keys and the web cache use new
  namespaces; retain the old ones for rollback and allow expiring cache
  entries to expire normally.
- The local Compose project changes from `notefinder` to `vozzify`, which
  changes its implicit volume names. Existing volumes are not renamed by
  `compose up`. If local data is needed, stop the old stack, back up its
  Postgres and MinIO data, restore into the new volumes and verify it before
  retiring the old stack. Never use `down -v` or remove the old volumes as
  part of the rename. A new Postgres user's environment variables do not
  rename roles or databases inside an initialized volume.
- `S3_BUCKET=vozzify` is the new local/example bucket name. A live bucket
  needs a separately configured target and object copy; changing the env
  value does not transfer files. Compare object counts/checksums, keep old
  URLs readable and verify stored avatar/vocal URLs before changing traffic.
  Serve files through `files.vozzify.com`, which the image optimizer allows;
  update existing stored URLs only after the corresponding objects are
  reachable there. Do not invent a renamed Backblaze bucket hostname.
- Music catalog sync discovers its triggers by the owned outbox functions
  as well as the current trigger prefix. On startup it reconciles old
  trigger names to `vozzify_sync_*`, keeping the same outbox and functions.
  Pause replication/catalog writes while the first upgraded worker
  reconciles the triggers, then resume them after installation completes.
  Run the trigger rename e2e regression before rollout.

## Verification and rollback

Install with `nub install --frozen-lockfile`: the shared workspace package
is now `@vozzify/contracts`. Run lint, types, coverage, build, knip and
duplication, then API/catalog e2e and the web's auth, sharing, terms and
image-loading flows. Check a real verification email, session cookie scope,
an existing uploaded object and a completed processing job on the new host.

Keep the previous images, environment values, database backups and original
volumes/objects through the rollback window. To roll back, pause producers,
drain any new-namespace work, restore the previous images/configuration and
route traffic back only when its workers and data agree. Before rolling the catalog back, stop its writer/worker and reconcile the
trigger names to the previous prefix: older images discover triggers by
that prefix. Keep the shared outbox functions and pending entries intact. No data cleanup is included in this repository change.
