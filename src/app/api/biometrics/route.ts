import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface BPMPayload {
  sessionId: string;
  scenarioId?: string | null;
  bpm: number;
  recordedAt: number;
  deviceId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const readings: BPMPayload[] = await req.json();

    if (!Array.isArray(readings) || readings.length === 0) {
      return NextResponse.json({ error: 'Expected a non-empty array of readings.' }, { status: 400 });
    }

    // Validate all readings
    for (const r of readings) {
      if (!r.sessionId || typeof r.bpm !== 'number' || r.bpm <= 0 || r.bpm >= 300) {
        return NextResponse.json(
          { error: 'Each reading must have a valid sessionId and bpm (1–299).' },
          { status: 400 }
        );
      }
    }

    // Batch insert
    await prisma.biometricReading.createMany({
      data: readings.map(r => ({
        sessionId: r.sessionId,
        scenarioId: r.scenarioId || null,
        bpm: Math.round(r.bpm),
        recordedAt: BigInt(Math.round(r.recordedAt)),
        deviceId: r.deviceId || null,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ inserted: readings.length }, { status: 201 });
  } catch (err) {
    console.error('[biometrics POST]', err);
    return NextResponse.json({ error: 'Failed to record biometric data.' }, { status: 500 });
  }
}
