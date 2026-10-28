# Music catalog deployment

The `Music catalog images` workflow builds both images for pull requests and
publishes `latest` and `sha-<commit>` tags on relevant pushes to `main`.
After the Compose checks and both image publications succeed, its deploy job
asks Coolify to pull the new images and recreate the production stack.
Pull requests never call the production endpoint.

## Coolify configuration

Configure these repository Actions secrets:

| Secret | Value |
| --- | --- |
| `COOLIFY_MUSIC_CATALOG_DEPLOY_URL` | The private Coolify service restart URL, ending in `/api/v1/services/<service-uuid>/restart?latest=true` |
| `COOLIFY_DEPLOY_TOKEN` | A token with only the `deploy` permission for the resource's team |

Use these image references in the saved Coolify Compose definition:

```yaml
services:
  server:
    image: ghcr.io/theryston/vozzify/music-catalog:latest
  mbslave:
    image: ghcr.io/theryston/vozzify/music-catalog-mbslave:latest
```

The server, worker and migration job use the first image; the importer uses
the second. Keep upstream image versions, persistent volumes, environment
variables, internal networking and published ports configured independently.
The Compose in this folder remains the standalone stack template.

The restart URL must include `latest=true`: a normal restart does not pull
new images. The deployment request accepts HTTP or HTTPS, never prints its
URL, token or response body, and fails the job if Coolify rejects the request.
It sends the request once to avoid queuing duplicate deployments after an
ambiguous network failure. A successful request means the deployment was
queued; check the Coolify logs and container health for its completion.

Redeploying during the first import restarts the database restore from the
beginning. Downloaded archives remain in the dumps volume. Once the catalog
is ready, subsequent starts skip the first import and resume replication.

To roll back, set both images to their matching previous `sha-<commit>` tag
and deploy. Read the migration SQL before rolling back across a migration.

## Deployment request tests

```sh
bash .github/scripts/deploy-coolify.test.sh
```

The tests exercise the real request script with a fake curl executable:
successful HTTP and HTTPS calls, POST authentication, missing configuration,
unsupported URL schemes, and private output on network and HTTP failures.
They never contact Coolify or restart a container.
