CREATE TABLE "music_catalog"."reimport_state" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"phase" text NOT NULL,
	"progress_pct" integer,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reimport_state_single_row" CHECK ("music_catalog"."reimport_state"."id")
);
--> statement-breakpoint
ALTER TABLE "music_catalog"."replication_state" ADD COLUMN "stalled_reason" text;--> statement-breakpoint
ALTER TABLE "music_catalog"."replication_state" ADD COLUMN "stalled_detail" text;--> statement-breakpoint
ALTER TABLE "music_catalog"."replication_state" ADD COLUMN "stalled_mbslave_ref" text;