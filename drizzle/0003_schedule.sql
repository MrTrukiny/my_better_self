CREATE TABLE "occurrence" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occurrence_task_date" UNIQUE("task_id","date")
);
--> statement-breakpoint
CREATE TABLE "schedule_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"start_times" text[] NOT NULL,
	"weekday_minutes" integer NOT NULL,
	"weekend_minutes" integer NOT NULL,
	"time_zone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_settings_seven_days" CHECK (cardinality("schedule_settings"."start_times") = 7),
	CONSTRAINT "schedule_settings_budgets" CHECK ("schedule_settings"."weekday_minutes" between 30 and 120 and "schedule_settings"."weekend_minutes" between 30 and 120)
);
--> statement-breakpoint
ALTER TABLE "occurrence" ADD CONSTRAINT "occurrence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrence" ADD CONSTRAINT "occurrence_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_settings" ADD CONSTRAINT "schedule_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "occurrence_user_date_idx" ON "occurrence" USING btree ("user_id","date");