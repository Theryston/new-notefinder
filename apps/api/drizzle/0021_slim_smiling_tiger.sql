CREATE TABLE "user_follows" (
	"id" text PRIMARY KEY NOT NULL,
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_follows_follower_following_unique" UNIQUE("follower_id","following_id"),
	CONSTRAINT "user_follows_not_self" CHECK ("user_follows"."follower_id" <> "user_follows"."following_id")
);
--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_follows_following_id_index" ON "user_follows" USING btree ("following_id");