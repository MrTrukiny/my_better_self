CREATE TABLE "calendar_connection" (
	"user_id" text PRIMARY KEY NOT NULL,
	"calendar_id" text,
	"calendar_name" text,
	"status" text DEFAULT 'ok' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_connection_status" CHECK ("calendar_connection"."status" in ('ok', 'reauth', 'error'))
);
--> statement-breakpoint
CREATE TABLE "calendar_day" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"event_id" text NOT NULL,
	"digest" text NOT NULL,
	"overlap" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_day_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "calendar_connection" ADD CONSTRAINT "calendar_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_day" ADD CONSTRAINT "calendar_day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;