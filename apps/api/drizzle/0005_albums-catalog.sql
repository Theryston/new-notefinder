CREATE TABLE "album_artists" (
	"album_id" text NOT NULL,
	"artist_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "album_artists_album_id_artist_id_pk" PRIMARY KEY("album_id","artist_id"),
	CONSTRAINT "album_artists_position_unique" UNIQUE("album_id","position")
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" text PRIMARY KEY NOT NULL,
	"mbid" text NOT NULL,
	"title" text NOT NULL,
	"primary_type" text,
	"secondary_types" text[] DEFAULT '{}' NOT NULL,
	"year" integer,
	"genres" text[] DEFAULT '{}' NOT NULL,
	"cover_art_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "albums_mbid_unique" UNIQUE("mbid")
);
--> statement-breakpoint
CREATE TABLE "legacy_album_ids" (
	"legacy_id" text PRIMARY KEY NOT NULL,
	"album_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_album_ids" ADD CONSTRAINT "legacy_album_ids_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_artists_artist_id_index" ON "album_artists" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "legacy_album_ids_album_id_index" ON "legacy_album_ids" USING btree ("album_id");