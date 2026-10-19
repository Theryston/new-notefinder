ALTER TABLE "users" ADD COLUMN "show_summary_section" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "show_practice_history_section" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "show_favorites_section" boolean DEFAULT true NOT NULL;