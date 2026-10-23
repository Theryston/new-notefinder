CREATE TABLE "track_cooccurrences" (
  "source_track_id" text NOT NULL,
  "target_track_id" text NOT NULL,
  "singer_count" integer NOT NULL,
  CONSTRAINT "track_cooccurrences_source_track_id_target_track_id_pk" PRIMARY KEY("source_track_id", "target_track_id"),
  CONSTRAINT "track_cooccurrences_source_track_id_tracks_id_fk" FOREIGN KEY ("source_track_id") REFERENCES "tracks"("id") ON DELETE CASCADE,
  CONSTRAINT "track_cooccurrences_target_track_id_tracks_id_fk" FOREIGN KEY ("target_track_id") REFERENCES "tracks"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "track_cooccurrences_source_track_id_singer_count_index" ON "track_cooccurrences" USING btree ("source_track_id", "singer_count");
