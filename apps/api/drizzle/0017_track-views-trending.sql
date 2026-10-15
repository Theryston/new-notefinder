CREATE TABLE "track_views" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "trending_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "track_views" ADD CONSTRAINT "track_views_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_views" ADD CONSTRAINT "track_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_views_track_id_created_at_index" ON "track_views" USING btree ("track_id","created_at");--> statement-breakpoint
CREATE INDEX "track_views_created_at_index" ON "track_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "track_views_user_id_index" ON "track_views" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tracks_trending_score_id_index" ON "tracks" USING btree ("trending_score","id");