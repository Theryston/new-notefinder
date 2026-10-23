CREATE TABLE "user_acquisitions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"first_touch" jsonb,
	"last_touch" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_acquisitions_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "visitor_id" text;--> statement-breakpoint
ALTER TABLE "user_acquisitions" ADD CONSTRAINT "user_acquisitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;