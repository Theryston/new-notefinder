CREATE TABLE "track_lyric_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"position" integer NOT NULL,
	"start" double precision NOT NULL,
	"end" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "track_lyric_lines_position_unique" UNIQUE("track_id","position")
);
--> statement-breakpoint
CREATE TABLE "track_lyric_words" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"line_id" text NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"start" double precision NOT NULL,
	"end" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "track_lyric_words_line_position_unique" UNIQUE("line_id","position")
);
--> statement-breakpoint
ALTER TABLE "track_lyric_lines" ADD CONSTRAINT "track_lyric_lines_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_lyric_words" ADD CONSTRAINT "track_lyric_words_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_lyric_words" ADD CONSTRAINT "track_lyric_words_line_id_track_lyric_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."track_lyric_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_lyric_words_track_id_index" ON "track_lyric_words" USING btree ("track_id");