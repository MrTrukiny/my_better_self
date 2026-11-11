CREATE TABLE "task_adjustment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"change" text NOT NULL,
	"name" text,
	"minutes" integer,
	"frequency_days" integer,
	"reason" text NOT NULL,
	"evidence" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_adjustment_change" CHECK ("task_adjustment"."change" in ('minutes', 'frequency', 'new_task'))
);
--> statement-breakpoint
ALTER TABLE "task_adjustment" ADD CONSTRAINT "task_adjustment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_adjustment" ADD CONSTRAINT "task_adjustment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_adjustment_user_id_idx" ON "task_adjustment" USING btree ("user_id");