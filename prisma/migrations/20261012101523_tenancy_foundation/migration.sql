-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'PLATFORM';

-- AlterTable
ALTER TABLE "assessment_sessions" ADD COLUMN     "client_account_id" TEXT,
ADD COLUMN     "job_context_id" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'OFFICIAL',
ADD COLUMN     "practice_email" TEXT,
ADD COLUMN     "practice_job_text" TEXT,
ADD COLUMN     "practice_name" TEXT,
ADD COLUMN     "purge_after" TIMESTAMP(3),
ADD COLUMN     "registry_opt_in" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scenario_order" JSONB,
ADD COLUMN     "scoring_basis" JSONB,
ADD COLUMN     "scoring_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "session_depth" INTEGER;

-- AlterTable
ALTER TABLE "final_scores" ADD COLUMN     "exercised" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "max_score" DOUBLE PRECISION,
ADD COLUMN     "min_score" DOUBLE PRECISION,
ADD COLUMN     "raw_score" DOUBLE PRECISION,
ADD COLUMN     "scoring_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'PLATFORM',
ADD COLUMN     "client_account_id" TEXT;

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "active_ai_provider_key" TEXT,
ADD COLUMN     "default_client_package_id" TEXT,
ADD COLUMN     "default_session_depth" INTEGER,
ADD COLUMN     "email_from" TEXT,
ADD COLUMN     "email_provider" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "practice_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sandbox_package_id" TEXT,
ADD COLUMN     "storage_config" JSONB,
ADD COLUMN     "storage_provider" TEXT NOT NULL DEFAULT 'VERCEL_BLOB',
ADD COLUMN     "synthesis_daily_call_limit" INTEGER NOT NULL DEFAULT 200;

-- AlterTable
ALTER TABLE "scenario_options" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "scenario_packages" ADD COLUMN     "source_format" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'GLOBAL';

-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN     "decision_point" TEXT,
ADD COLUMN     "external_ref" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "client_account_id" TEXT,
ADD COLUMN     "resume_text" TEXT;

-- CreateTable
CREATE TABLE "client_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "access_key_prefix" TEXT,
    "access_key_hash" TEXT,
    "access_key_last4" TEXT,
    "access_key_rotated_at" TIMESTAMP(3),
    "logo_url" TEXT,
    "assigned_package_id" TEXT,
    "storage_config" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_account_members" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CLIENT_ADMIN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_account_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_contexts" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT,
    "title" TEXT NOT NULL,
    "role_family" TEXT,
    "description_text" TEXT NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_invites" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "job_context_id" TEXT,
    "candidate_name" TEXT NOT NULL,
    "candidate_email" TEXT NOT NULL,
    "target_role" TEXT,
    "token_hash" TEXT NOT NULL,
    "session_depth" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "opened_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" TEXT,

    CONSTRAINT "assessment_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "admin_id" TEXT,
    "client_account_id" TEXT,
    "invite_id" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "id" TEXT NOT NULL,
    "bucket_key" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_documents" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT,
    "user_id" TEXT,
    "session_id" TEXT,
    "storage_provider" TEXT NOT NULL DEFAULT 'VERCEL_BLOB',
    "blob_url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "parsed_text" TEXT,
    "parse_status" TEXT NOT NULL DEFAULT 'PENDING',
    "parse_error" TEXT,
    "parsed_at" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "provider_type" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "base_url" TEXT,
    "api_key_env_var" TEXT,
    "api_key_cipher" TEXT,
    "api_key_last4" TEXT,
    "max_tokens" INTEGER NOT NULL DEFAULT 1024,
    "temperature" DOUBLE PRECISION,
    "extra_headers" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_tested_at" TIMESTAMP(3),
    "last_test_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_evaluations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "provider_key" TEXT NOT NULL,
    "provider_id" TEXT,
    "model" TEXT NOT NULL,
    "tier" TEXT,
    "rationale" TEXT,
    "prompt_hash" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_registry_entries" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SANDBOX',
    "session_id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "job_context_text" TEXT,
    "resume_text" TEXT,
    "decision_score" DOUBLE PRECISION,
    "percentile" DOUBLE PRECISION,
    "is_high_signal" BOOLEAN NOT NULL DEFAULT false,
    "ranked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_registry_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archetype_syntheses" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "query_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "provider_key" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archetype_syntheses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT,
    "template" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "provider_message_id" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_accounts_slug_key" ON "client_accounts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "client_accounts_access_key_prefix_key" ON "client_accounts"("access_key_prefix");

-- CreateIndex
CREATE INDEX "client_accounts_status_deleted_at_idx" ON "client_accounts"("status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "client_account_members_client_account_id_admin_id_key" ON "client_account_members"("client_account_id", "admin_id");

-- CreateIndex
CREATE INDEX "job_contexts_client_account_id_is_archived_idx" ON "job_contexts"("client_account_id", "is_archived");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_invites_token_hash_key" ON "assessment_invites"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_invites_session_id_key" ON "assessment_invites"("session_id");

-- CreateIndex
CREATE INDEX "assessment_invites_client_account_id_status_idx" ON "assessment_invites"("client_account_id", "status");

-- CreateIndex
CREATE INDEX "assessment_invites_candidate_email_idx" ON "assessment_invites"("candidate_email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "auth_sessions_admin_id_idx" ON "auth_sessions"("admin_id");

-- CreateIndex
CREATE INDEX "audit_logs_client_account_id_created_at_idx" ON "audit_logs"("client_account_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_window_start_idx" ON "rate_limit_buckets"("window_start");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_buckets_bucket_key_window_start_key" ON "rate_limit_buckets"("bucket_key", "window_start");

-- CreateIndex
CREATE UNIQUE INDEX "resume_documents_session_id_key" ON "resume_documents"("session_id");

-- CreateIndex
CREATE INDEX "resume_documents_client_account_id_idx" ON "resume_documents"("client_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_configs_key_key" ON "ai_provider_configs"("key");

-- CreateIndex
CREATE INDEX "ai_evaluations_session_id_created_at_idx" ON "ai_evaluations"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "talent_registry_entries_session_id_key" ON "talent_registry_entries"("session_id");

-- CreateIndex
CREATE INDEX "talent_registry_entries_source_is_high_signal_idx" ON "talent_registry_entries"("source", "is_high_signal");

-- CreateIndex
CREATE UNIQUE INDEX "archetype_syntheses_session_id_query_hash_model_key" ON "archetype_syntheses"("session_id", "query_hash", "model");

-- CreateIndex
CREATE INDEX "email_logs_status_created_at_idx" ON "email_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "assessment_sessions_client_account_id_kind_status_started_a_idx" ON "assessment_sessions"("client_account_id", "kind", "status", "started_at");

-- CreateIndex
CREATE INDEX "assessment_sessions_kind_purge_after_idx" ON "assessment_sessions"("kind", "purge_after");

-- CreateIndex
CREATE INDEX "notifications_client_account_id_is_read_created_at_idx" ON "notifications"("client_account_id", "is_read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "scenarios_package_id_external_ref_key" ON "scenarios"("package_id", "external_ref");

-- CreateIndex
CREATE INDEX "users_client_account_id_created_at_idx" ON "users"("client_account_id", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_job_context_id_fkey" FOREIGN KEY ("job_context_id") REFERENCES "job_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_accounts" ADD CONSTRAINT "client_accounts_assigned_package_id_fkey" FOREIGN KEY ("assigned_package_id") REFERENCES "scenario_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_account_members" ADD CONSTRAINT "client_account_members_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_account_members" ADD CONSTRAINT "client_account_members_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_contexts" ADD CONSTRAINT "job_contexts_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_invites" ADD CONSTRAINT "assessment_invites_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_invites" ADD CONSTRAINT "assessment_invites_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "scenario_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_invites" ADD CONSTRAINT "assessment_invites_job_context_id_fkey" FOREIGN KEY ("job_context_id") REFERENCES "job_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_invites" ADD CONSTRAINT "assessment_invites_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_documents" ADD CONSTRAINT "resume_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_documents" ADD CONSTRAINT "resume_documents_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_provider_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_registry_entries" ADD CONSTRAINT "talent_registry_entries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archetype_syntheses" ADD CONSTRAINT "archetype_syntheses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

