CREATE TABLE "music_catalog"."track_association" (
	"recording_mbid" uuid PRIMARY KEY NOT NULL,
	"track_id" text,
	"pending" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
