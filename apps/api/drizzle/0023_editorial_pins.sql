CREATE TYPE "public"."editorial_pin_audience" AS ENUM('everyone', 'visitors');--> statement-breakpoint
CREATE TYPE "public"."editorial_pin_history_action" AS ENUM('CREATED', 'UPDATED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."editorial_pin_kind" AS ENUM('hero', 'row');--> statement-breakpoint
CREATE TYPE "public"."editorial_pin_layout" AS ENUM('hero', 'standard');--> statement-breakpoint
CREATE TYPE "public"."editorial_pin_locale" AS ENUM('en', 'pt-BR');--> statement-breakpoint
CREATE TABLE "editorial_pin_history" (
	"id" text PRIMARY KEY NOT NULL,
	"pin_id" text NOT NULL,
	"action" "editorial_pin_history_action" NOT NULL,
	"changed_fields" text[] NOT NULL,
	"state" jsonb NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_pin_tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"pin_id" text NOT NULL,
	"track_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_pin_tracks_pin_position_unique" UNIQUE("pin_id","position"),
	CONSTRAINT "editorial_pin_tracks_pin_track_unique" UNIQUE("pin_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "editorial_pins" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "editorial_pin_kind" NOT NULL,
	"layout" "editorial_pin_layout" NOT NULL,
	"position" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"audience" "editorial_pin_audience" DEFAULT 'everyone' NOT NULL,
	"locale" "editorial_pin_locale",
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"titles" jsonb NOT NULL,
	"sponsored" boolean DEFAULT false NOT NULL,
	"created_by_id" text,
	"updated_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "editorial_pin_history" ADD CONSTRAINT "editorial_pin_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_pin_tracks" ADD CONSTRAINT "editorial_pin_tracks_pin_id_editorial_pins_id_fk" FOREIGN KEY ("pin_id") REFERENCES "public"."editorial_pins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_pin_tracks" ADD CONSTRAINT "editorial_pin_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_pins" ADD CONSTRAINT "editorial_pins_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_pins" ADD CONSTRAINT "editorial_pins_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "editorial_pin_history_pin_id_created_at_index" ON "editorial_pin_history" USING btree ("pin_id","created_at");--> statement-breakpoint
CREATE INDEX "editorial_pin_tracks_track_id_index" ON "editorial_pin_tracks" USING btree ("track_id");