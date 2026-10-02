ALTER TABLE "music_catalog"."bootstrap_state" ALTER COLUMN "dataset" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "music_catalog"."catalog_dataset";--> statement-breakpoint
CREATE TYPE "music_catalog"."catalog_dataset" AS ENUM('full', 'tiny');--> statement-breakpoint
ALTER TABLE "music_catalog"."bootstrap_state" ALTER COLUMN "dataset" SET DATA TYPE "music_catalog"."catalog_dataset" USING "dataset"::"music_catalog"."catalog_dataset";