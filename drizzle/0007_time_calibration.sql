ALTER TABLE "occurrence" ADD COLUMN "planned_minutes" integer;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "minutes_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "calibrated_from" integer;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "calibrated_samples" integer;