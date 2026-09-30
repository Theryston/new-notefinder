CREATE TABLE "music_catalog"."indexing_checkpoint" (
	"index_uid" text PRIMARY KEY NOT NULL,
	"last_recording_id" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
