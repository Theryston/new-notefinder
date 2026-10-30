CREATE TABLE "subscription_price_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence" bigserial NOT NULL,
	"subscription_id" text NOT NULL,
	"user_id" text NOT NULL,
	"old_price_id" text NOT NULL,
	"new_price_id" text NOT NULL,
	"old_amount" integer NOT NULL,
	"new_amount" integer NOT NULL,
	"notice_status" text DEFAULT 'pending' NOT NULL,
	"notice_started_at" timestamp with time zone,
	"notice_sent_at" timestamp with time zone,
	"effective_at" timestamp with time zone,
	"notice_attempt" integer DEFAULT 0 NOT NULL,
	"notice_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notice_message" jsonb,
	"reconcile_cursor" text,
	"next_reconcile_at" timestamp with time zone,
	"schedule_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_price_changes_sequence_unique" UNIQUE("sequence"),
	CONSTRAINT "subscription_price_changes_subscriptionId_newPriceId_unique" UNIQUE("subscription_id","new_price_id")
);
--> statement-breakpoint
ALTER TABLE "subscription_price_changes" ADD CONSTRAINT "subscription_price_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_price_changes" ADD CONSTRAINT "subscription_price_changes_old_price_id_plan_prices_id_fk" FOREIGN KEY ("old_price_id") REFERENCES "public"."plan_prices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_price_changes" ADD CONSTRAINT "subscription_price_changes_new_price_id_plan_prices_id_fk" FOREIGN KEY ("new_price_id") REFERENCES "public"."plan_prices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_price_changes_notice_status_schedule_status_index" ON "subscription_price_changes" USING btree ("notice_status","schedule_status");