-- AlterTable
ALTER TABLE "talent_registry_entries" ADD COLUMN     "embedded_at" TIMESTAMP(3),
ADD COLUMN     "embedding" JSONB,
ADD COLUMN     "embedding_model" TEXT;

