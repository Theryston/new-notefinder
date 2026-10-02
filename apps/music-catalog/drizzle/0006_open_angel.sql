CREATE TABLE "music_catalog"."lrclib_refresh_state" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"last_dump_key" text,
	"last_checked_at" timestamp with time zone,
	"last_imported_at" timestamp with time zone,
	CONSTRAINT "lrclib_refresh_state_single_row" CHECK ("music_catalog"."lrclib_refresh_state"."id")
);
