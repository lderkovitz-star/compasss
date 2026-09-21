import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET single scenario with options
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scenario = await prisma.scenario.findUnique({
    where: { id: params.id },
    include: {
      options: { 
        orderBy: { optionCode: 'asc' },
        include: { scores: true }
      },
      package: { select: { name: true, code: true } },
    },
  });
  if (!scenario) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json(scenario);
}

// PUT — update scenario + its options
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { narrativeText, timeLimitSec, sequenceOrder, options } = body;

    const updated = await prisma.$transaction(async (tx) => {
      const scenario = await tx.scenario.update({
        where: { id: params.id },
        data: {
          narrativeText,
          timeLimitSec: Number(timeLimitSec),
          sequenceOrder: Number(sequenceOrder),
        },
      });

      // Update each option if provided
      if (Array.isArray(options)) {
        for (const opt of options) {
          if (opt.id) {
            await tx.scenarioOption.update({
              where: { id: opt.id },
              data: { optionText: opt.optionText },
            });
            
            // Sync OptionScores if provided
            if (Array.isArray(opt.scores)) {
              // Clear existing scores for this option
              await tx.optionScore.deleteMany({
                where: { optionId: opt.id }
              });
              
              // Create new scores
              if (opt.scores.length > 0) {
                await tx.optionScore.createMany({
                  data: opt.scores.map((s: any) => ({
                    optionId: opt.id,
                    dimensionId: s.dimensionId,
                    weightScore: Number(s.weightScore)
                  }))
                });
              }
            }
          }
        }
      }
      return scenario;
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[scenario PUT]', err);
    return NextResponse.json({ error: 'Failed to update scenario.' }, { status: 500 });
  }
}

// DELETE — scenario soft delete
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.scenario.update({
      where: { id: params.id },
      data: { deletedAt: new Date() }
    });
    return NextResponse.json({ deleted: params.id });
  } catch (err) {
    console.error('[scenario DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete scenario.' }, { status: 500 });
  }
}
