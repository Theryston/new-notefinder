ALTER TABLE "tracks" ADD COLUMN "vocal_range_low_midi" double precision;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "vocal_range_high_midi" double precision;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "estimated_key_tonic" integer;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "estimated_key_mode" text;--> statement-breakpoint
WITH completed AS (
  SELECT DISTINCT track_id
  FROM track_processings
  WHERE status = 'COMPLETED'
), pitch_classes AS (
  SELECT
    track_notes.track_id,
    mod(mod(round(track_notes.pitch)::integer, 12) + 12, 12) AS pitch_class,
    sum(greatest(track_notes."end" - track_notes.start, 0)) AS weight
  FROM track_notes
  INNER JOIN completed ON completed.track_id = track_notes.track_id
  GROUP BY track_notes.track_id, mod(mod(round(track_notes.pitch)::integer, 12) + 12, 12)
), note_ranges AS (
  SELECT
    track_notes.track_id,
    min(track_notes.pitch) AS low_midi,
    max(track_notes.pitch) AS high_midi
  FROM track_notes
  INNER JOIN completed ON completed.track_id = track_notes.track_id
  GROUP BY track_notes.track_id
), profiles AS (
  SELECT 'MAJOR'::text AS mode, ARRAY[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]::double precision[] AS profile
  UNION ALL
  SELECT 'MINOR'::text, ARRAY[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]::double precision[]
), histogram AS (
  SELECT completed.track_id, pitch_class, coalesce(pitch_classes.weight, 0) AS weight
  FROM completed
  CROSS JOIN generate_series(0, 11) AS pitch_class
  LEFT JOIN pitch_classes USING (track_id, pitch_class)
), samples AS (
  SELECT
    histogram.track_id,
    tonic,
    profiles.mode,
    histogram.weight,
    profiles.profile[((histogram.pitch_class - tonic + 12) % 12) + 1] AS profile_value
  FROM histogram
  CROSS JOIN profiles
  CROSS JOIN generate_series(0, 11) AS tonic
), scores AS (
  SELECT
    track_id,
    tonic,
    mode,
    sum((weight - avg_weight) * (profile_value - avg_profile)) /
      sqrt(sum((weight - avg_weight) ^ 2) * sum((profile_value - avg_profile) ^ 2)) AS score
  FROM (
    SELECT
      samples.*,
      avg(weight) OVER (PARTITION BY track_id) AS avg_weight,
      avg(profile_value) OVER (PARTITION BY mode) AS avg_profile
    FROM samples
  ) centered
  GROUP BY track_id, tonic, mode
), best_keys AS (
  SELECT DISTINCT ON (track_id) track_id, tonic, mode
  FROM scores
  WHERE score IS NOT NULL
  ORDER BY track_id, score DESC, mode, tonic
)
UPDATE tracks
SET
  vocal_range_low_midi = note_ranges.low_midi,
  vocal_range_high_midi = note_ranges.high_midi,
  estimated_key_tonic = best_keys.tonic,
  estimated_key_mode = best_keys.mode
FROM completed
LEFT JOIN note_ranges USING (track_id)
LEFT JOIN best_keys USING (track_id)
WHERE tracks.id = completed.track_id;
