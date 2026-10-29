ALTER TABLE "billing_customers" ADD COLUMN "trial_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_days" integer DEFAULT 0 NOT NULL;