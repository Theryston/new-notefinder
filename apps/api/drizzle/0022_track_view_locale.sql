CREATE TYPE "public"."track_view_locale" AS ENUM('en', 'pt-BR');--> statement-breakpoint
ALTER TABLE "track_views" ADD COLUMN "locale" "track_view_locale";