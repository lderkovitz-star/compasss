-- Candidates become tenant-scoped, and practice runs become possible.
--
-- This is the one migration in the set that can fail on live data rather than
-- just adding to it, so each step states what it assumes.
--
-- Run prisma/backfill/001-legacy-tenant.ts first: it creates the account that
-- owns everything predating tenancy and stamps every existing candidate and
-- sitting with it. The checks below refuse to proceed if anything was missed,
-- which is the intended outcome - a half-applied tenancy model is worse than a
-- failed migration.

-- 1. Every candidate must already have an owning tenant.
DO $$
DECLARE orphans bigint;
BEGIN
  SELECT count(*) INTO orphans FROM users WHERE client_account_id IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot make users.client_account_id NOT NULL: % user row(s) have no tenant. Run the legacy-tenant backfill first.', orphans;
  END IF;
END $$;

-- 2. Email becomes unique per tenant, not globally. The same person may be a
--    candidate at two employers, which the global constraint forbade.
DO $$
DECLARE clashes bigint;
BEGIN
  SELECT count(*) INTO clashes FROM (
    SELECT client_account_id, lower(email) FROM users
    GROUP BY 1, 2 HAVING count(*) > 1
  ) d;
  IF clashes > 0 THEN
    RAISE EXCEPTION
      'Cannot add the per-tenant unique index: % (tenant, email) pair(s) are duplicated. Merge those candidates first.', clashes;
  END IF;
END $$;

-- DropIndex
DROP INDEX "users_email_key";

-- AlterTable: practice runs have no candidate record, so a sitting need not
-- belong to one. Relaxing a constraint, so nothing can be lost here.
ALTER TABLE "assessment_sessions" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "client_account_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_client_account_id_email_key" ON "users"("client_account_id", "email");
