-- External scores on the candidate profile. JSON rather than columns so a new
-- kind of score needs no migration: see src/lib/external-scores.ts.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "external_scores" JSONB;

-- Completion webhook per employer account. Both nullable: an account without
-- a URL simply gets no call, which is every existing account.
ALTER TABLE "client_accounts"
  ADD COLUMN IF NOT EXISTS "webhook_url" TEXT,
  ADD COLUMN IF NOT EXISTS "webhook_secret" TEXT;

-- Evaluator questions and the answers given.
CREATE TABLE IF NOT EXISTS "evaluator_queries" (
  "id" TEXT NOT NULL,
  "client_account_id" TEXT,
  "asked_by_admin_id" TEXT,
  "asked_by_email" TEXT,
  "question" TEXT NOT NULL,
  "query_hash" TEXT NOT NULL,
  "session_ids" JSONB NOT NULL,
  "answer" TEXT NOT NULL,
  "provider_key" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "latency_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "evaluator_queries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "evaluator_queries_client_account_id_created_at_idx"
  ON "evaluator_queries"("client_account_id", "created_at");

CREATE INDEX IF NOT EXISTS "evaluator_queries_query_hash_model_idx"
  ON "evaluator_queries"("query_hash", "model");

DO $$ BEGIN
  ALTER TABLE "evaluator_queries"
    ADD CONSTRAINT "evaluator_queries_client_account_id_fkey"
    FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The open, uninvited intake route. Defaulted OFF, which is a behaviour
-- change on purpose: with it on, anyone who finds /intake becomes a candidate
-- inside a real employer account. Strangers belong in the practice sandbox.
-- Turn it back on from Master Admin if a deployment genuinely wants it.
ALTER TABLE "platform_settings"
  ADD COLUMN IF NOT EXISTS "open_intake_enabled" BOOLEAN NOT NULL DEFAULT false;
