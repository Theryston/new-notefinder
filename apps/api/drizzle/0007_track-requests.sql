CREATE TYPE "public"."track_contribution_kind" AS ENUM('CREATE', 'RETRY');--> statement-breakpoint
CREATE TYPE "public"."track_processing_failure_code" AS ENUM('VIDEO_NOT_FOUND', 'TOO_LONG', 'DOWNLOAD_FAILED', 'NOTE_DETECTION_FAILED', 'INTERNAL');--> statement-breakpoint
CREATE TYPE "public"."track_processing_status" AS ENUM('QUEUED', 'FINDING_VIDEO', 'DOWNLOADING_AUDIO', 'EXTRACTING_VOCALS', 'DETECTING_NOTES', 'EXTRACTING_LYRICS', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."track_processing_step" AS ENUM('FINDING_VIDEO', 'DOWNLOADING_AUDIO', 'EXTRACTING_VOCALS', 'DETECTING_NOTES', 'EXTRACTING_LYRICS');--> statement-breakpoint
CREATE TYPE "public"."track_processing_video_source" AS ENUM('musicbrainz', 'youtube_music');--> statement-breakpoint
CREATE TYPE "public"."user_locale" AS ENUM('en', 'pt-BR');--> statement-breakpoint
CREATE TABLE "track_contributions" (
	"id" text PRIMARY KEY NOT NULL,
	"contributor_id" text NOT NULL,
	"kind" "track_contribution_kind" NOT NULL,
	"processing_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_contributors" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "track_contributors_track_user_unique" UNIQUE("track_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "track_processings" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"status" "track_processing_status" DEFAULT 'QUEUED' NOT NULL,
	"failure_code" "track_processing_failure_code",
	"resume_from" "track_processing_step",
	"video_id" text,
	"video_source" "track_processing_video_source",
	"music_wav_url" text,
	"music_mp3_url" text,
	"vocals_wav_url" text,
	"vocals_mp3_url" text,
	"runpod_job_id" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "youtube_video_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" "user_locale" DEFAULT 'pt-BR' NOT NULL;--> statement-breakpoint
ALTER TABLE "track_contributions" ADD CONSTRAINT "track_contributions_contributor_id_track_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."track_contributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_contributions" ADD CONSTRAINT "track_contributions_processing_id_track_processings_id_fk" FOREIGN KEY ("processing_id") REFERENCES "public"."track_processings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_contributors" ADD CONSTRAINT "track_contributors_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_contributors" ADD CONSTRAINT "track_contributors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_processings" ADD CONSTRAINT "track_processings_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_contributions_contributor_id_index" ON "track_contributions" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX "track_contributions_processing_id_index" ON "track_contributions" USING btree ("processing_id");--> statement-breakpoint
CREATE INDEX "track_contributors_user_id_index" ON "track_contributors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "track_processings_track_id_created_at_index" ON "track_processings" USING btree ("track_id","created_at");