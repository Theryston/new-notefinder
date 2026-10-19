# 10. Lyrics only from ElevenLabs

- Status: accepted
- Date: 2026-10-19

## Context

ADR 0002 put open Lyrics into the Music catalog: the LRCLIB dump (issues #63
and #64), matched strictly to each Recording, kept in Postgres and indexed for
search. It came with a refresh from newer dumps, an outbox lookup against
LRCLIB's public API, a `lyrics` search index and two tables.

The cost was large for a feature nothing reads:

- The first import downloads 47.6 GB and needs about 260 GB of temporary disk
  while it unpacks, per import and per refresh.
- The catalog's search was made metadata-only (issue #307), so the `lyrics`
  index fed no query, and `getRecording` never read the Lyrics either.
- Every change to the import, the match and the reimport carried the Lyrics
  along, which is complexity for a value nobody had shown.

The words a User sees on a Track are its Timed lyrics: they are transcribed
from the Track's vocals during its Processing (ADR 0004), with ElevenLabs
Scribe v2 in the API. That is the only source the product needs.

## Decision

- **The Music catalog holds no Lyrics.** Removed: the LRCLIB dump and its
  schema check, the public API client, the strict match, the refresh, the
  outbox lookup, the `lyrics` search index, the `recording_lyrics` and
  `lrclib_refresh_state` tables (migration `0008_drop_lyrics`), the `LRCLIB_*`
  variables, the `lrclib-scratch` volume and the dump's temporary directory in
  the Dockerfile (#321 and #310, which also covers the production compose).
- **Timed lyrics are the only words of a Track**, and they come only from the
  ElevenLabs transcription of its Processing. The catalog never supplies them.
- **Kept:** the MusicBrainz sync and its Meilisearch `recordings` index, the
  WebSocket protocol (`status`, `getRecording`, `search`, `getReleaseGroup`,
  `getArtist`), and the blue-green reimport, which now rebuilds the catalog
  without carrying any Lyrics over.
- **Revisiting it** is a new ADR. It needs the source, its licence, the disk it
  takes and the product use it serves, measured the way ADR 0002 measured the
  MusicBrainz dump.

## Consequences

- The first import is the MusicBrainz restore alone: no LRCLIB download and no
  260 GB of temporary disk. A yearly reimport has no Lyrics step either.
- A catalog deployed before this change loses its kept Lyrics when migration
  `0008_drop_lyrics` runs. They can be rebuilt only by importing LRCLIB again,
  so restoring them means a new decision, not a rollback of this migration.
- Only MusicBrainz data and the words of Processing are left. No API or web path
  reads the catalog for lyrics, so no endpoint or page changes.
- The LRCLIB analysis in `docs/research/music-catalog-spike.md` stays as the
  record of why the dump was considered; it is not the current design.
