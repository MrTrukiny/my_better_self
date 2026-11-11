ALTER TABLE "occurrence" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "occurrence" ADD CONSTRAINT "occurrence_note_length" CHECK (char_length("occurrence"."note") <= 200);