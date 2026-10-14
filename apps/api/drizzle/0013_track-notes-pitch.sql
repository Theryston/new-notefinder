DELETE FROM "track_notes";--> statement-breakpoint
ALTER TABLE "track_notes" ADD COLUMN "pitch" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "track_notes" DROP COLUMN "note";--> statement-breakpoint
ALTER TABLE "track_notes" DROP COLUMN "octave";--> statement-breakpoint
ALTER TABLE "track_notes" DROP COLUMN "frequency_mean";