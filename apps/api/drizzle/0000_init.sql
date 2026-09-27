CREATE TYPE "public"."playing_copyright" AS ENUM('ALLOW_PLAY', 'ALLOW_TRANSPOSE', 'ALLOW_VOCALS_ONLY');--> statement-breakpoint
CREATE TYPE "public"."track_status" AS ENUM('QUEUED', 'DOWNLOADING_THUMBNAILS', 'DOWNLOADING_VIDEO', 'EXTRACTING_LYRICS', 'EXTRACTING_VOCALS', 'DETECTING_VOCALS_NOTES', 'ERROR', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "albums" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"yt_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"yt_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thumbnails" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_artists" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"artist_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"note" text NOT NULL,
	"octave" integer NOT NULL,
	"start" double precision NOT NULL,
	"end" double precision NOT NULL,
	"frequency_mean" double precision NOT NULL,
	"creator_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"yt_id" text NOT NULL,
	"job_id" text,
	"status" "track_status" DEFAULT 'QUEUED' NOT NULL,
	"status_description" text,
	"playing_copyright" "playing_copyright"[] DEFAULT '{}' NOT NULL,
	"music_url" text,
	"music_mp3_url" text,
	"vocals_url" text,
	"vocals_mp3_url" text,
	"lyrics_url" text,
	"title" text,
	"duration" text,
	"duration_seconds" integer,
	"year" integer,
	"is_explicit" boolean,
	"album_id" text,
	"score" integer DEFAULT 0 NOT NULL,
	"creator_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "thumbnails" ADD CONSTRAINT "thumbnails_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_notes" ADD CONSTRAINT "track_notes_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "albums_yt_id_index" ON "albums" USING btree ("yt_id");--> statement-breakpoint
CREATE INDEX "artists_yt_id_index" ON "artists" USING btree ("yt_id");--> statement-breakpoint
CREATE INDEX "thumbnails_track_id_index" ON "thumbnails" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_artists_track_id_index" ON "track_artists" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_artists_artist_id_index" ON "track_artists" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "track_notes_track_id_start_index" ON "track_notes" USING btree ("track_id","start");--> statement-breakpoint
CREATE INDEX "tracks_yt_id_index" ON "tracks" USING btree ("yt_id");--> statement-breakpoint
CREATE INDEX "tracks_album_id_index" ON "tracks" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "tracks_creator_id_index" ON "tracks" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "tracks_status_score_created_at_index" ON "tracks" USING btree ("status","score","created_at");--> statement-breakpoint
CREATE INDEX "tracks_score_created_at_index" ON "tracks" USING btree ("score","created_at");--> statement-breakpoint
CREATE INDEX "tracks_created_at_index" ON "tracks" USING btree ("created_at");