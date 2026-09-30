CREATE SCHEMA "music_catalog";
--> statement-breakpoint
CREATE TYPE "music_catalog"."bootstrap_phase" AS ENUM('restoring', 'restored', 'indexing', 'ready');--> statement-breakpoint
CREATE TYPE "music_catalog"."catalog_dataset" AS ENUM('sample', 'full');--> statement-breakpoint
CREATE TABLE "music_catalog"."bootstrap_state" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"phase" "music_catalog"."bootstrap_phase" DEFAULT 'restoring' NOT NULL,
	"dataset" "music_catalog"."catalog_dataset" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bootstrap_state_single_row" CHECK ("music_catalog"."bootstrap_state"."id")
);
