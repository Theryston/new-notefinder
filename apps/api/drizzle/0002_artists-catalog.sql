CREATE TABLE "artists" (
	"id" text PRIMARY KEY NOT NULL,
	"mbid" text NOT NULL,
	"name" text NOT NULL,
	"genres" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artists_mbid_unique" UNIQUE("mbid")
);
--> statement-breakpoint
CREATE TABLE "legacy_artist_ids" (
	"legacy_id" text PRIMARY KEY NOT NULL,
	"artist_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_artists" (
	"track_id" text NOT NULL,
	"artist_id" text NOT NULL,
	CONSTRAINT "track_artists_track_id_artist_id_pk" PRIMARY KEY("track_id","artist_id")
);
--> statement-breakpoint
ALTER TABLE "legacy_artist_ids" ADD CONSTRAINT "legacy_artist_ids_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legacy_artist_ids_artist_id_index" ON "legacy_artist_ids" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "track_artists_artist_id_index" ON "track_artists" USING btree ("artist_id");