CREATE TYPE "public"."octave_mode" AS ENUM('ANY', 'EXACT');--> statement-breakpoint
CREATE TYPE "public"."practice_difficulty" AS ENUM('EASY', 'NORMAL', 'HARD');--> statement-breakpoint
CREATE TABLE "practice_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"track_id" text NOT NULL,
	"difficulty" "practice_difficulty" NOT NULL,
	"octave_mode" "octave_mode" NOT NULL,
	"transpose_semitones" integer NOT NULL,
	"speed" real NOT NULL,
	"accuracy" real NOT NULL,
	"coverage" real NOT NULL,
	"forward_skip" boolean DEFAULT false NOT NULL,
	"bleed_suspected" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_practice_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"difficulty" "practice_difficulty" DEFAULT 'NORMAL' NOT NULL,
	"octave_mode" "octave_mode" DEFAULT 'ANY' NOT NULL,
	"guide_melody" boolean DEFAULT false NOT NULL,
	"count_in" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_practice_preferences" ADD CONSTRAINT "user_practice_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_attempts_user_id_track_id_index" ON "practice_attempts" USING btree ("user_id","track_id");--> statement-breakpoint
CREATE INDEX "practice_attempts_user_id_created_at_index" ON "practice_attempts" USING btree ("user_id","created_at");