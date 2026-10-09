CREATE TABLE "track_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"note" text NOT NULL,
	"octave" integer NOT NULL,
	"start" double precision NOT NULL,
	"end" double precision NOT NULL,
	"frequency_mean" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "track_notes" ADD CONSTRAINT "track_notes_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_notes_track_id_start_index" ON "track_notes" USING btree ("track_id","start");