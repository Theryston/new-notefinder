CREATE TABLE "music_catalog"."recording_outbox" (
	"recording_id" integer NOT NULL,
	"recording_mbid" uuid NOT NULL,
	"enqueued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "recording_outbox_recording_id_recording_mbid_pk" PRIMARY KEY("recording_id","recording_mbid")
);
