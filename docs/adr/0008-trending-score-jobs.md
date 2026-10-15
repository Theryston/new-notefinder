# 8. The trending score is recomputed by a debounced job and a daily job

- Status: accepted
- Date: 2026-10-15

## Context

A Track's trending score (legacy formula: hour, day, week, month and all-time
view counts, a trend boost against platform averages, a log scale) is read by
the Tracks sitemap to order the pages. The legacy app recomputed it from the
browser: a view created a calculation job that waited 15 minutes, and a daily
task recomputed the Tracks whose last calculation was older than 7 days. The
browser no longer triggers anything here.

The score depends on time as well as on views: its windows are calendar
windows (this hour, today, this week, this month), so a Track whose views stop
keeps a high score until something recomputes it.

## Decision

- **After a view:** `POST /v1/tracks/:trackId/views` queues a delayed job (15
  minutes) on the `track-trending` queue. The job ID is the Track plus the
  delay-long time slot of the view (`trendingJobId`). Views in one slot share
  one job, which runs after the slot ends, so it sees every one of them. A view
  in the next slot gets a job of its own even while the previous one is still
  running, so no view waits more than two delays for its score. Jobs are
  removed when they end, so a finished slot never blocks the Track.
- **Every day:** a BullMQ job scheduler (`upsertJobScheduler`, registered on
  boot, 00:00 UTC) recomputes every Track whose score is above 0, reading the
  platform averages once. A Track whose views stopped falls to 0 once its
  windows have rolled. The legacy 7-day staleness check is not kept: a daily
  run over the scored Tracks is simpler and bounds the lag to one day.
- **Revalidation:** a per-Track refresh revalidates that Track's tag only (the
  view count). The sitemap tag is revalidated by the daily run, since a per-view
  refresh happens every few minutes under steady traffic and the tag also
  covers the other sitemaps.

## Consequences

- The score of a Track lags its views by at most two delays; the score of a
  Track that stopped being viewed lags by at most a day.
- The daily run is one query per scored Track. If the number of scored Tracks
  grows into the hundreds of thousands, page it by cursor and spread it over
  jobs.
- Windows are UTC, so every instance agrees; the legacy app used its server's
  local calendar.
