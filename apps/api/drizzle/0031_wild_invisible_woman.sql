CREATE TABLE "track_association_events" (
	"id" text PRIMARY KEY NOT NULL,
	"recording_mbid" text NOT NULL,
	"track_id" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_until" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "track_association_events" ADD CONSTRAINT "track_association_events_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_association_events_pending_idx" ON "track_association_events" USING btree ("next_attempt_at","created_at") WHERE "track_association_events"."delivered_at" is null;--> statement-breakpoint
CREATE INDEX "track_association_events_delivered_idx" ON "track_association_events" USING btree ("delivered_at") WHERE "track_association_events"."delivered_at" is not null;