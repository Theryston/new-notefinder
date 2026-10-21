# 13. Events and acquisition: buffered raw ingestion, a local-storage visitor id, partitioned storage

- Status: accepted
- Date: 2026-10-21

## Context

The home must tell which rows and positions are seen and clicked, so the feed
can improve; and the campaigns that bring visitors must join to the account
when a visitor signs up, so sign-ups attribute to their channel. Both need
client data without hurting the page: a traffic peak must not become a
database peak, a click must never wait for its event, and nothing may set a
cookie (no consent banner).

## Decision

**A generic events module, not a home-specific one.** `POST /v1/events` is
public with optional authentication. It validates one bounded batch (at most
50 events, each a known `type` with its fields), drops known bot user agents
after the 202, and is rate-limited per IP (a tighter limit than the global
one, like the search endpoint) and per visitor id (a bounded Redis bucket
keyed by the batch's visitor id, same budget, so one device can't spend the
whole IP budget). Per-visitor abuse beyond that is bounded by
the batch cap itself: one request can only ever carry 50 events.

**Ingestion answers before storing.** The endpoint pushes the batch onto the
`events` Redis queue and answers 202 with how many it accepted (`{ accepted:
n }`, 0 for a dropped bot batch). A job (`store-events`) stores the batch
with a single `INSERT`, never one insert per event. A signed-in batch stores
the User id; an anonymous one stores only the visitor id.

**Events are stored raw.** One row per event in the `events` table: the
visitor id, the User id when signed in, the event `type`, the home columns it
carries (`rowId`, `feedVersion`, `algorithmVersion`, `itemId`, `position`,
all nullable so future event kinds need no new columns) and the whole event
as `payload`. No retention or rollup job ships: nothing is deleted.

**The table is partitioned by month on `createdAt`.** The migration turns the
table into a `PARTITION BY RANGE ("createdAt")` table (the primary key covers
`(id, createdAt)`, since a partitioned table only allows uniqueness with the
partition key in it), creates partitions for the current month and the next
few, and adds the `create_events_month_partition(year, month)` function that
creates the next month's partition ahead of time. Without a matching partition
an insert fails loudly instead of landing in the wrong place; there is no
default partition. The operator creates the next month's partition with the
month's deploy until a scheduled job does it (out of scope, like retention).

**The visitor id lives in local storage, not a cookie.** The browser keeps a
random id under `notefinder:visitor-id` and sends it with every batch. No
cookie is set, so no consent banner is needed. The id is stored on the User at
sign-up, joining earlier events to the account without a backfill. Browsers
that clear storage after days without a visit lose attribution for late
sign-ups; the mobile app needs an equivalent store (both out of scope).

**The home is the first producer.** A row impression is sent once per row per
page load, when the row is at least half visible for at least one second,
carrying the row id, the feed version, the algorithm version and the items on
screen with their positions. Impressions queue in the page and flush in
batches: every few seconds and when the page hides. A card is a real link; on
click the client fires the click event asynchronously (`sendBeacon`, falling
back to a keepalive `fetch`) and navigates immediately — nothing is awaited,
nothing is prevented, so navigation stays instant. Linking a click to the
Track view it caused, and to the practice that followed, is a later slice, as
is attaching the campaign data at sign-up:

**Acquisition (later slice).** On any landing page the client stores the
first touch (never overwritten) and the last touch (replaced by each new
arrival that carries campaign data) in local storage. Tracked fields come from
a fixed allowlist: the five UTM fields, the ad click ids (`gclid`, `fbclid`,
`ttclid`, `msclkid`), the referrer and the landing path. After the first
authenticated load following sign-up, the web sends the stored touches to
`POST /v1/me/acquisition`; the API records them once, and only for accounts
created in roughly the last 30 minutes, over both email and Google sign-up.
The client then clears the stored touches. Sign-up counts as the User's
acceptance, and the terms text mentions the collection.

## Consequences

- A burst of visitors costs one small queue write per batch, answered at
  once; the database sees one `INSERT` per batch, whenever the worker runs.
- Bot traffic and floods never reach the table: bots are dropped after the
  202, oversized or invalid batches are refused with `VALIDATION_FAILED`, and
  the per-IP and per-visitor limits answer 429 `RATE_LIMITED` above them.
- Analysis reads raw rows with the full event in `payload`, the User when the
  batch was signed in, and the feed version for every home event.
- Raw volume grows fast under paid traffic and nothing is deleted in this
  scope: monitor the partitions. Adding retention needs the maintainer's
  approval per the large-data rule.
- A signed-in visit and an anonymous one differ only in the stored User id;
  the response is the same 202 either way.

## Alternatives considered

- **Write the events in the request.** Rejected: a traffic burst would become
  a burst of database writes on the request path, exactly what the feed
  caching exists to avoid.
- **A cookie for the visitor id.** Rejected: it would need a consent banner
  and would be sent on every request; local storage keeps the id where only
  the instrumented pages read it.
- **One table per event kind, or a column per field.** Rejected: every new
  producer would need a migration. The raw `payload` plus the home columns
  the first producer needs keeps the schema stable while staying queryable.
- **A default partition as a safety net.** Rejected: rows would silently land
  outside their month and break the partitioning the analysis relies on. A
  loud failure plus partitions created ahead of time is safer.
