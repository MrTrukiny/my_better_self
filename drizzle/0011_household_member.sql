CREATE TABLE "household_member" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone,
	CONSTRAINT "household_member_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "household_member" ADD CONSTRAINT "household_member_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_member" ADD CONSTRAINT "household_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "household_member_email_unique" ON "household_member" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "household_member_owner_id_idx" ON "household_member" USING btree ("owner_id");