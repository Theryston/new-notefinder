ALTER TABLE "tracks" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "length_ms" integer;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "disambiguation" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "video" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "isrcs" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "genres" text[] DEFAULT '{}' NOT NULL;