CREATE TABLE "legacy_track_ids" (
	"legacy_id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"recording_mbid" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracks_recording_mbid_unique" UNIQUE("recording_mbid")
);
--> statement-breakpoint
ALTER TABLE "legacy_track_ids" ADD CONSTRAINT "legacy_track_ids_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legacy_track_ids_track_id_index" ON "legacy_track_ids" USING btree ("track_id");