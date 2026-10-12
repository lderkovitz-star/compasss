-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_role" TEXT,
    "hobbies_skills" TEXT,
    "resume_file_url" TEXT,
    "resume_uploaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "backdrop_image_url" TEXT,

    CONSTRAINT "scenario_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimensions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "sequence_order" INTEGER NOT NULL,
    "narrative_text" TEXT NOT NULL,
    "time_limit_sec" INTEGER NOT NULL DEFAULT 60,
    "deleted_at" TIMESTAMP(3),
    "backdrop_image_url" TEXT,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_options" (
    "id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "option_code" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,

    CONSTRAINT "scenario_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_scores" (
    "id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "dimension_id" TEXT NOT NULL,
    "weight_score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "option_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "current_scenario_idx" INTEGER NOT NULL DEFAULT 0,
    "trait_scores" JSONB,
    "human_overrides" JSONB,
    "ai_evaluation" JSONB,

    CONSTRAINT "assessment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "time_spent_ms" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision_path" JSONB,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_snapshots" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "dimension_id" TEXT NOT NULL,
    "cumulative_score" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_scores" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "dimension_id" TEXT NOT NULL,
    "final_score" DOUBLE PRECISION NOT NULL,
    "percentile_rank" DOUBLE PRECISION,

    CONSTRAINT "final_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_readings" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "scenario_id" TEXT,
    "bpm" INTEGER NOT NULL,
    "recorded_at" BIGINT NOT NULL,
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biometric_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Admin',
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "password_hash" TEXT NOT NULL,
    "profile_image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "platform_name" TEXT NOT NULL DEFAULT 'Compass',
    "support_email" TEXT NOT NULL DEFAULT 'support@compass.com',
    "biometric_mode" TEXT NOT NULL DEFAULT 'disabled',
    "anti_cheat" BOOLEAN NOT NULL DEFAULT true,
    "blind_ui_mode" BOOLEAN NOT NULL DEFAULT true,
    "logo_url" TEXT,
    "default_backdrop_url" TEXT,
    "anthropic_api_key" TEXT,
    "ai_prompt_template" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_packages_code_key" ON "scenario_packages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "dimensions_code_key" ON "dimensions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "final_scores_session_id_dimension_id_key" ON "final_scores"("session_id", "dimension_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "scenario_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_options" ADD CONSTRAINT "scenario_options_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_scores" ADD CONSTRAINT "option_scores_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "scenario_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_scores" ADD CONSTRAINT "option_scores_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "dimensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "scenario_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "scenario_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "dimensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_scores" ADD CONSTRAINT "final_scores_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_scores" ADD CONSTRAINT "final_scores_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "dimensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_readings" ADD CONSTRAINT "biometric_readings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_readings" ADD CONSTRAINT "biometric_readings_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

