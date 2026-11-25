-- Scenario pack version pinning. Additive only: existing rows keep working
-- unchanged (every pack starts at revision 1, nothing is superseded yet, and
-- sittings that began before this have no recorded revision).

-- AlterTable
ALTER TABLE "scenario_packages" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN "superseded_by_id" TEXT;

-- AlterTable
ALTER TABLE "assessment_sessions" ADD COLUMN "package_revision" INTEGER;
