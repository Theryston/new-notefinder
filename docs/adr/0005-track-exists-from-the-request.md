# 5. A Track exists from the request, with Processings and Contributions

- Status: accepted
- Date: 2026-10-08

## Context

A signed-in User picks a Recording that has no Track yet and watches its
Processing in real time. The Processing can fail and be retried, and later
features will let Users edit a Track's notes and Timed lyrics, so who did what
to a Track has to be kept.

## Decision

- **The Track row is created when a User asks for it**, from the Music
  catalog's Recording, before any Processing step runs. Its URL
  (`/tracks/[trackId]`) is final from the start and shows the Processing
  progress until it completes. Asking for a Recording that already has a Track
  only redirects to it.
- **Each run of the pipeline is a Processing row**, not a status column on the
  Track. A retry after a failure is a new Processing that reuses what the
  failed one already produced and starts at the failed step.
- **Contributors and Contributions are two tables**: a Contributor is one
  (Track, User) pair, and each action is a new Contribution with its kind
  (`CREATE`, `RETRY` for now; editing kinds arrive with their features).
- **Until a Track has a completed Processing it is reachable only by its own
  URL** (and from search). Artist and Album lists, counts and the sitemap only
  include completed Tracks.

## Consequences

- A Track can exist with no notes, so every reader of Tracks must decide
  whether it wants completed ones only.
- Retrying and reprocessing keep history instead of overwriting it.
- The legacy `Track.creatorId` maps to a `CREATE` Contribution when the legacy
  catalog is reprocessed.
