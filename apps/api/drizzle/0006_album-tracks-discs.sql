CREATE TABLE "album_discs" (
	"album_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text,
	CONSTRAINT "album_discs_album_id_position_pk" PRIMARY KEY("album_id","position")
);
--> statement-breakpoint
CREATE TABLE "album_tracks" (
	"album_id" text NOT NULL,
	"track_id" text NOT NULL,
	"disc_position" integer NOT NULL,
	"track_position" integer NOT NULL,
	CONSTRAINT "album_tracks_album_id_track_id_pk" PRIMARY KEY("album_id","track_id")
);
--> statement-breakpoint
ALTER TABLE "album_discs" ADD CONSTRAINT "album_discs_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_tracks" ADD CONSTRAINT "album_tracks_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_tracks" ADD CONSTRAINT "album_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_tracks" ADD CONSTRAINT "album_tracks_album_id_disc_position_album_discs_album_id_position_fk" FOREIGN KEY ("album_id","disc_position") REFERENCES "public"."album_discs"("album_id","position") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_tracks_track_id_index" ON "album_tracks" USING btree ("track_id");