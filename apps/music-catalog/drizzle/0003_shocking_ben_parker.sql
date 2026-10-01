CREATE TABLE "music_catalog"."replication_state" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"last_sequence" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "replication_state_single_row" CHECK ("music_catalog"."replication_state"."id")
);
