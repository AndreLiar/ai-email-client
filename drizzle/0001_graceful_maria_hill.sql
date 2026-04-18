ALTER TABLE "users" ADD COLUMN "gmail_access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gmail_refresh_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gmail_updated_at" timestamp with time zone;