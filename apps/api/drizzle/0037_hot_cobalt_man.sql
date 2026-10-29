ALTER TABLE "subscriptions" ADD COLUMN "has_paid_invoice" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "recovery_invoice_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "recovery_started_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "subscriptions" SET "has_paid_invoice" = true WHERE "status" = 'confirmed' AND "provider_status" = 'active' AND "paid_membership" = true;
