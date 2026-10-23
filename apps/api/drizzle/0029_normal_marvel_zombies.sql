CREATE TABLE "practice_heartbeats" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"view_id" text,
	"elapsed_seconds" integer NOT NULL,
	"credited_seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "click_id" text;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD COLUMN "view_id" text;--> statement-breakpoint
ALTER TABLE "track_views" ADD COLUMN "click_id" text;--> statement-breakpoint
ALTER TABLE "track_views" ADD COLUMN "visitor_id" text;--> statement-breakpoint
ALTER TABLE "practice_heartbeats" ADD CONSTRAINT "practice_heartbeats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_heartbeats" ADD CONSTRAINT "practice_heartbeats_view_id_track_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."track_views"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_view_id_track_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."track_views"("id") ON DELETE set null ON UPDATE no action;