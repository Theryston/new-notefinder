CREATE TABLE "music_catalog"."recording_lyrics" (
	"mbid" text PRIMARY KEY NOT NULL,
	"plain_lyrics" text,
	"synced_lyrics" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
