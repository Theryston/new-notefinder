CREATE TABLE "events" (
	"id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"row_id" text,
	"feed_version" text,
	"algorithm_version" integer,
	"item_id" text,
	"position" integer,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_id_created_at_pk" PRIMARY KEY("id","created_at")
) PARTITION BY RANGE ("created_at");
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_created_at_index" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_user_id_index" ON "events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_visitor_id_created_at_index" ON "events" USING btree ("visitor_id","created_at");--> statement-breakpoint
-- Monthly partitions. The endpoint only ever inserts "now", so the table
-- works as long as the current month has a partition. New partitions appear
-- by calling `select create_events_month_partition(2027, 4)` (any future
-- month) ahead of time; the operator creates the next month's partition with
-- the month's deploy, and a retention/deletion job is explicitly out of scope
-- (see docs/adr/0013-events-and-acquisition.md). Without a matching partition
-- an insert fails instead of landing in the wrong place: no default partition.
CREATE OR REPLACE FUNCTION create_events_month_partition(year integer, month integer)
RETURNS text AS $$
DECLARE
	partition_name text := format('events_%s_%s', year, lpad(month::text, 2, '0'));
	start_date date := make_date(year, month, 1);
	end_date date := (start_date + interval '1 month')::date;
BEGIN
	IF to_regclass(partition_name) IS NOT NULL THEN
		RETURN partition_name;
	END IF;
	EXECUTE format(
		'CREATE TABLE %I PARTITION OF "events" FOR VALUES FROM (%L) TO (%L)',
		partition_name, start_date, end_date
	);
	RETURN partition_name;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
SELECT create_events_month_partition(2026, 10);--> statement-breakpoint
SELECT create_events_month_partition(2026, 11);--> statement-breakpoint
SELECT create_events_month_partition(2026, 12);--> statement-breakpoint
SELECT create_events_month_partition(2027, 1);--> statement-breakpoint
SELECT create_events_month_partition(2027, 2);--> statement-breakpoint
SELECT create_events_month_partition(2027, 3);--> statement-breakpoint
