ALTER TABLE "occurrence" ADD COLUMN "status" text DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "occurrence" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedule_settings" ADD COLUMN "replanned_on" date;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "first_due" date;--> statement-breakpoint
ALTER TABLE "occurrence" ADD CONSTRAINT "occurrence_status" CHECK ("occurrence"."status" in ('scheduled', 'done', 'skipped'));--> statement-breakpoint
-- Before check-off, past days counted as done as planned (ADR 0007); keep that history.
UPDATE "occurrence" SET "status" = 'done' WHERE "date" < current_date;
