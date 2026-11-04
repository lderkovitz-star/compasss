-- Candidate seat limits per employer account.
-- Nullable with no default: every existing account stays unlimited, so adding
-- the column cannot start refusing invitations for anyone who never set one.
ALTER TABLE "client_accounts"
  ADD COLUMN IF NOT EXISTS "candidate_seat_limit" INTEGER;

-- Consent framework settings. Defaulted so a settings row that predates this
-- migration reads as "consent required, version 1.0, default wording".
ALTER TABLE "platform_settings"
  ADD COLUMN IF NOT EXISTS "consent_required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "consent_policy_version" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS "consent_statement" TEXT;

-- One consent record per sitting, holding the wording verbatim.
CREATE TABLE IF NOT EXISTS "candidate_consents" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "user_id" TEXT,
  "client_account_id" TEXT,
  "policy_version" TEXT NOT NULL,
  "statement_text" TEXT NOT NULL,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip_address" TEXT,
  "user_agent" TEXT,

  CONSTRAINT "candidate_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_consents_session_id_key"
  ON "candidate_consents"("session_id");

CREATE INDEX IF NOT EXISTS "candidate_consents_client_account_id_accepted_at_idx"
  ON "candidate_consents"("client_account_id", "accepted_at");

-- Cascades: a deleted sitting or a purged account takes its consent record
-- with it, which is the behaviour a deletion request needs.
DO $$ BEGIN
  ALTER TABLE "candidate_consents"
    ADD CONSTRAINT "candidate_consents_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "candidate_consents"
    ADD CONSTRAINT "candidate_consents_client_account_id_fkey"
    FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
