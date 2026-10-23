CREATE TABLE "track_cooccurrences" (
	"id" text PRIMARY KEY NOT NULL,
	"source_track_id" text NOT NULL,
	"target_track_id" text NOT NULL,
	"singer_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "track_cooccurrences" ADD CONSTRAINT "track_cooccurrences_source_track_id_tracks_id_fk" FOREIGN KEY ("source_track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_cooccurrences" ADD CONSTRAINT "track_cooccurrences_target_track_id_tracks_id_fk" FOREIGN KEY ("target_track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_cooccurrences_source_track_id_singer_count_index" ON "track_cooccurrences" USING btree ("source_track_id","singer_count");--> statement-breakpoint
CREATE UNIQUE INDEX "track_cooccurrences_source_track_id_target_track_id_index" ON "track_cooccurrences" USING btree ("source_track_id","target_track_id");