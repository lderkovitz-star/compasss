-- Server-side decision timing, live tab-switch logging, and per-answer event ids.
-- Additive only: new nullable columns on responses (existing rows stay as they
-- are) and two new tables. The unique index on client_event_id cannot clash
-- with existing rows, which all have it null.

-- AlterTable
ALTER TABLE "responses" ADD COLUMN     "client_event_id" TEXT,
ADD COLUMN     "hidden_ms" INTEGER,
ADD COLUMN     "server_elapsed_ms" INTEGER,
ADD COLUMN     "tab_switches" INTEGER,
ADD COLUMN     "telemetry" JSONB;

-- CreateTable
CREATE TABLE "scenario_views" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "first_served_at" TIMESTAMP(3) NOT NULL,
    "last_served_at" TIMESTAMP(3) NOT NULL,
    "serve_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "scenario_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "client_at_ms" INTEGER,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scenario_views_session_id_scenario_id_key" ON "scenario_views"("session_id", "scenario_id");

-- CreateIndex
CREATE INDEX "telemetry_events_session_id_scenario_id_received_at_idx" ON "telemetry_events"("session_id", "scenario_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "responses_client_event_id_key" ON "responses"("client_event_id");

-- AddForeignKey
ALTER TABLE "scenario_views" ADD CONSTRAINT "scenario_views_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_views" ADD CONSTRAINT "scenario_views_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

