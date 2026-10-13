CREATE TABLE "track_favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"track_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "track_favorites_user_track_unique" UNIQUE("user_id","track_id")
);
--> statement-breakpoint
ALTER TABLE "track_favorites" ADD CONSTRAINT "track_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_favorites" ADD CONSTRAINT "track_favorites_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_favorites_track_id_index" ON "track_favorites" USING btree ("track_id");