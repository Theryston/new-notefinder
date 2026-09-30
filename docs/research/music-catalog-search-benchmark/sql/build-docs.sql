-- One row per Recording with the metadata fields of the spec kept apart, so
-- every engine indexes the same content: Meilisearch and Postgres keep the
-- fields (and weight them), Sonic gets them concatenated into one text.
-- Adapted from the spike's document query (docs/research/music-catalog-spike.md,
-- appendix), with the artist credit taken as MusicBrainz displays it
-- (artist_credit.name, join phrases included) because that is what a user
-- types.
--
-- `stage` splits the Recordings into four equal buckets by hash, so an index
-- can be grown 25% -> 50% -> 100% to measure how each engine scales. The
-- query targets are forced into stage 1 by `bench queries`, so every query is
-- answerable at every stage.
CREATE SCHEMA IF NOT EXISTS bench;
DROP TABLE IF EXISTS bench.doc;
CREATE UNLOGGED TABLE bench.doc AS
SELECT r.id,
       r.gid AS mbid,
       r.name AS title,
       NULLIF(r.comment, '') AS disambiguation,
       ac.name AS artist_credit,
       art.names AS artist_aliases,
       rel.titles AS release_titles,
       wk.titles AS work_titles,
       gn.names AS genres,
       (1 + (abs(hashtextextended(r.gid::text, 0)) % 4))::smallint AS stage
  FROM musicbrainz.recording r
  JOIN musicbrainz.artist_credit ac ON ac.id = r.artist_credit
  LEFT JOIN LATERAL (
    SELECT string_agg(concat_ws(' ', a.name, a.sort_name, al.names), ' ') AS names
      FROM musicbrainz.artist_credit_name acn
      JOIN musicbrainz.artist a ON a.id = acn.artist
      LEFT JOIN LATERAL (
        SELECT string_agg(concat_ws(' ', aa.name, aa.sort_name), ' ') AS names
          FROM musicbrainz.artist_alias aa WHERE aa.artist = a.id) al ON true
     WHERE acn.artist_credit = r.artist_credit) art ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT rl.name, ' ') AS titles
      FROM musicbrainz.track t
      JOIN musicbrainz.medium m ON m.id = t.medium
      JOIN musicbrainz.release rl ON rl.id = m.release
     WHERE t.recording = r.id) rel ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT w.name, ' ') AS titles
      FROM musicbrainz.l_recording_work lrw
      JOIN musicbrainz.work w ON w.id = lrw.entity1
     WHERE lrw.entity0 = r.id) wk ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT g.name, ' ') AS names
      FROM musicbrainz.recording_tag rt
      JOIN musicbrainz.tag tg ON tg.id = rt.tag
      JOIN musicbrainz.genre g ON g.name = tg.name
     WHERE rt.recording = r.id) gn ON true
 ORDER BY r.id;
ALTER TABLE bench.doc ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX ON bench.doc (mbid);
ANALYZE bench.doc;
