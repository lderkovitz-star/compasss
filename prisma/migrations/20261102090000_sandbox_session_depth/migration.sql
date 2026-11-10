-- How long a public practice run is.
--
-- The sandbox slot normally points at the same long pack a real assessment
-- uses, which meant a visitor had to answer all fifty scenarios before any
-- result appeared. This caps the practice sitting on its own, without touching
-- the length of real assessments.
--
-- Additive and defaulted, so nothing reads it until the code that does ships.
ALTER TABLE "platform_settings"
  ADD COLUMN IF NOT EXISTS "sandbox_session_depth" INTEGER DEFAULT 10;
