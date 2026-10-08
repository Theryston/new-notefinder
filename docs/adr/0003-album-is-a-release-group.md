# 3. Album is a release group

- Status: accepted
- Date: 2026-10-08

## Context

notefinder shows an album page at `/albums/[id]`, reached from shared links and
from legacy bookmarks (ADR 0001 keeps those URLs working). MusicBrainz models an
album at two levels: a **release** is one edition (a country, a format, a
remaster, a reissue), and a **release group** is the album across all of its
editions ("A Night at the Opera", whatever the edition).

Using the release as the Album would split one album into one URL per edition,
repeat the same header over and over, and make the choice of edition visible to
visitors. The Track page already lists every release a Recording appears on
(`track_releases`), so editions have a home that is not the album page.

## Decision

- An **Album** is a MusicBrainz **release group**. Its MBID is the identity the
  importer reprocesses from, and it is unique in `albums`.
- The header fields come from the release group: title, primary and secondary
  types, first release year, genres and the artist credit in credit order.
  The cover is the release group's front cover from the Cover Art Archive.
- No filter applies to which release groups become albums (type, status or
  country). A filter would leave legacy album URLs without a target.
- A release group has no track list of its own. When the album's tracks are
  listed (a later slice), their disc and track positions come from one
  **representative release** that the importer picks for the release group.
  The choice is made once at import, so an album's track order does not change
  between page views.

## Consequences

- One URL per album, whatever its editions. The header never shows
  edition-specific data (country, format, barcode).
- Track order follows the representative release, which can differ from another
  edition of the same album. That trade-off is accepted: an edition is not what
  the album page is about.
- Legacy album IDs resolve through `legacy_album_ids` (ADR 0001); a legacy URL
  whose album was never reprocessed still answers 404.
- The Music catalog keeps its release and track data unchanged. Only the import
  that fills the API database reads the release group.
