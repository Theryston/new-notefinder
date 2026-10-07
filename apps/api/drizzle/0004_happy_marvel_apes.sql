CREATE TABLE "track_external_links" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"url" text NOT NULL,
	"link_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"mbid" text NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"cover_art_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"name" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_works" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"mbid" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "track_external_links" ADD CONSTRAINT "track_external_links_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_releases" ADD CONSTRAINT "track_releases_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_tags" ADD CONSTRAINT "track_tags_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_works" ADD CONSTRAINT "track_works_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_external_links_track_id_index" ON "track_external_links" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_releases_track_id_index" ON "track_releases" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_tags_track_id_index" ON "track_tags" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_works_track_id_index" ON "track_works" USING btree ("track_id");