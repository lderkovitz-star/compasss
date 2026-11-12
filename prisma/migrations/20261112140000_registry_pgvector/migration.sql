-- Talent Registry similarity search on pgvector. Additive: the vector
-- extension, one vector column beside the existing JSON embedding, and a copy
-- of the embeddings already stored, so current entries are searchable at once.
-- The JSON column stays and keeps working for other embedding sizes.

CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "talent_registry_entries" ADD COLUMN "embedding_vector" vector(1536);

-- Backfill from the JSON embeddings that are the right length.
UPDATE "talent_registry_entries"
SET "embedding_vector" = ("embedding"::text)::vector
WHERE "embedding" IS NOT NULL
  AND jsonb_typeof("embedding") = 'array'
  AND jsonb_array_length("embedding") = 1536;
