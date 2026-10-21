# 13. The signed-in home is a personal blend served from per-User snapshots

- Status: accepted
- Date: 2026-10-21

## Context

The public feed is the same for every visitor (ADR 0011), but a signed-in
visitor also has their own signals: the Tracks they started, the ones they
sing best, their favorites and their taste in genres and artists, and where
today's practice stands. The home should lead with rows to **resume**
practice and blend the rest with that taste, without ever computing a feed
inside a request and without leaking personal data to shared caches.

## Decision

**The personal pipeline blends popularity with taste.** The public feed of the
request's locale is the base; each of its Tracks is re-ranked by
`final = (1 − λ) · popularity + λ · personal`, where `popularity` is the
Track's trending score over the best one and `personal` mixes its genre and
artist affinities (`PERSONAL_GENRE_WEIGHT = 1`, `PERSONAL_ARTIST_WEIGHT = 2`,
the artist weighing more because it names the taste better). λ grows with the
User's amount of data (`personalLambda`: 0 without signals, 1 from
`PERSONAL_LAMBDA_SATURATION_SIGNALS = 50`), so a User with no data gets the
public rows untouched. All three are named constants with unit tests.

**Mastered Tracks leave the discovery rows.** A Track whose best accuracy
reached the hit band (`accuracyBand`, the same 85% as every accuracy band)
has its own "sing again" row, so the discovery rows filter it out.

**Resume rows lead.** "Continue singing" (Tracks started but not yet
accurate, newest run first) and "sing again" (the User's best Tracks, best
accuracy first) run through the same composer, so a row below the minimum
size is dropped like every other feed row. A daily target strip follows them:
the seconds left to complete the Practice day with the Streak, read from the
streak status. The snapshot's first page order is: resume rows, strip,
discovery.

**Snapshots in Redis, never computed in a request.** Each User's snapshot is
stored per locale (`home:personal:{userId}:{locale}:current`, TTL
`PERSONAL_SNAPSHOT_TTL_SECONDS = 7 days`, plus the build lock and retained
versions for cursors still in flight, like the public feed). A request serves
the snapshot, or the stale one, or — when there is none — the public rows as
the personal answer, and queues a rebuild. A snapshot older than
`PERSONAL_SNAPSHOT_STALE_AFTER_SECONDS = 6 hours` is served stale while its
rebuild runs.

**Rebuilds are debounced jobs plus a nightly batch.** A finished Attempt or a
favorite schedules a rebuild after `PERSONAL_REFRESH_DEBOUNCE_MS` (one job
per User, locale and delay-long time slot, the same slot pattern as the
trending score), so a practice session costs one rebuild. A repeatable job
(`refresh-personal-nightly`, 02:30 UTC) rebuilds every locale of the Users
with an Attempt or a heartbeat in the last
`PERSONAL_NIGHTLY_ACTIVE_WITHIN_DAYS = 14` days (capped at
`PERSONAL_NIGHTLY_MAX_USERS`). Every job is idempotent: rebuilding stores the
same snapshot, and an unchanged feed keeps its version.

**The API answers `audience: personal` with private headers.** A signed-in
first page or cursor page carries `audience: personal` and
`Cache-Control: private, no-store`, so no shared cache can keep it; anonymous
answers are unchanged. Cursors keep working across the two: a personal cursor
resumes its snapshot version, else the public one (relabeled personal).
Pins stay a read-time overlay (ADR 0012): they are applied when the personal
page is served, never stored in the snapshot.

**The web renders the signed-in home without the public one flashing.**
The home page reads the session cookie on the server: a visitor carrying one
gets the feed through a dynamic, cookie-forwarding fetch that is never cached
on the web, inside Suspense with the shared content-free skeleton, so no
public row ever flashes before the personal rows land. The resume carousels
land in the skeleton's carousel slots; cursor paging from the browser
forwards the session the same way.

## Consequences

- A signed-in visit costs one snapshot rebuild per User per staleness window
  or practice session, never per request; a burst of visits costs nothing
  extra while the snapshot is fresh.
- The snapshot stores rows, not ids: reads stay free of database work, at the
  cost of re-storing Track cards. A Track edited after the snapshot keeps its
  old card until the next rebuild.
- Triggers schedule every locale because the write requests carry none; the
  nightly batch covers every locale too, so a locale switch never waits for a
  rebuild.
- Rows the personal feed drops (a short resume row, a mastered discovery row)
  are gone rather than backfilled: the feed prefers the composer's full rows
  over filling every slot.
- The discovery pool only scores the hero and standard rows. Rows of a layout
  this slice doesn't know (the by-voice, genre and ranked rows the sibling
  wave-4 slices add to the public feed) stay out of the snapshot until their
  slice teaches the pool their shape; the web already skips what it doesn't
  render.

## Alternatives considered

- **Compute the personal feed in the request.** Rejected: a burst of
  signed-in visits would fan out to the same expensive queries the public
  feed refuses to run per request (ADR 0011).
- **One snapshot per User across locales.** Rejected: discovery mirrors the
  locale's public feed, whose trending differs per locale; a shared snapshot
  would serve one locale's rows to another's visit.
- **Bake pins into the snapshot.** Rejected already in ADR 0012: a pin would
  have to reach every snapshot and audience rules would apply at write time.
