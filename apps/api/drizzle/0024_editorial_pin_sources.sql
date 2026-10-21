CREATE TYPE "public"."editorial_pin_source_type" AS ENUM('tracks', 'genre', 'artist', 'album');--> statement-breakpoint
ALTER TABLE "editorial_pins" ADD COLUMN "source_type" "editorial_pin_source_type" DEFAULT 'tracks' NOT NULL;--> statement-breakpoint
ALTER TABLE "editorial_pins" ADD COLUMN "source_genre" text;--> statement-breakpoint
ALTER TABLE "editorial_pins" ADD COLUMN "source_artist_id" text;--> statement-breakpoint
ALTER TABLE "editorial_pins" ADD COLUMN "source_album_id" text;--> statement-breakpoint
ALTER TABLE "editorial_pins" ADD CONSTRAINT "editorial_pins_source_artist_id_artists_id_fk" FOREIGN KEY ("source_artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_pins" ADD CONSTRAINT "editorial_pins_source_album_id_albums_id_fk" FOREIGN KEY ("source_album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;