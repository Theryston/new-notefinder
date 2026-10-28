CREATE TABLE "plan_catalog_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"contracting_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_sync_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"body" jsonb NOT NULL,
	"status" text NOT NULL,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_prices" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "sale_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "stripe_product_id" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "pending_sync_id" text;--> statement-breakpoint
ALTER TABLE "plan_sync_operations" ADD CONSTRAINT "plan_sync_operations_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_sync_operations_plan_id_index" ON "plan_sync_operations" USING btree ("plan_id");