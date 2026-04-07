CREATE TABLE "builtin_memories" (
	"key" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"run_id" text,
	"sandbox_id" text,
	"source_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"blob_path" text NOT NULL,
	"blob_url" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "long_term_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text DEFAULT 'system',
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "long_term_memory_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector,
	"embedding_model" text,
	"embedding_dimensions" integer,
	"tsv" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"ui_message_id" text,
	"visible_in_chat" boolean DEFAULT true NOT NULL,
	"role" text NOT NULL,
	"step_number" integer,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text,
	"prompt" text NOT NULL,
	"timezone" text,
	"daily_time" text,
	"next_run_at" timestamp with time zone,
	"last_triggered_at" timestamp with time zone,
	"last_fired_for" timestamp with time zone,
	"schedule_workflow_run_id" text,
	"last_chat_run_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"content" text NOT NULL,
	"summary_version" integer NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"channel" text DEFAULT 'web' NOT NULL,
	"external_thread_id" text,
	"user_id" text,
	"model" text,
	"system_prompt" text,
	"status" text DEFAULT 'active' NOT NULL,
	"workflow_run_id" text,
	"sandbox_id" text,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"latest_token_usage" jsonb,
	"metadata" jsonb,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "long_term_memory_chunks" ADD CONSTRAINT "long_term_memory_chunks_memory_id_long_term_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."long_term_memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_memories" ADD CONSTRAINT "session_memories_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_session_created_at_idx" ON "files" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "files_run_created_at_idx" ON "files" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "long_term_memories_user_updated_idx" ON "long_term_memories" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "ltm_chunks_embedding_lookup_idx" ON "long_term_memory_chunks" USING btree ("embedding_model","embedding_dimensions");--> statement-breakpoint
CREATE INDEX "ltm_chunks_memory_chunk_idx" ON "long_term_memory_chunks" USING btree ("memory_id","chunk_index");--> statement-breakpoint
CREATE INDEX "ltm_chunks_tsv_idx" ON "long_term_memory_chunks" USING gin ("tsv");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_session_ui_message_id_idx" ON "messages" USING btree ("session_id","ui_message_id");--> statement-breakpoint
CREATE INDEX "session_memories_session_current_idx" ON "session_memories" USING btree ("session_id","is_current");