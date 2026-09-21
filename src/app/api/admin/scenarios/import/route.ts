import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { packageId, isNewPackage, packageData, scenarios } = body;

    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return NextResponse.json({ error: 'Scenarios array is required and must not be empty.' }, { status: 400 });
    }

    let targetPackageId = packageId;

    await prisma.$transaction(async (tx) => {
      // 1. Resolve Package
      if (isNewPackage) {
        if (!packageData?.packageName) {
          throw new Error('packageName is required for a new package.');
        }
        
        // Ensure a unique code
        const baseCode = packageData.packageName.replace(/\s+/g, '_').toUpperCase();
        let uniqueCode = baseCode;
        let count = 1;
        while (await tx.scenarioPackage.findUnique({ where: { code: uniqueCode } })) {
          uniqueCode = `${baseCode}_V${count++}`;
        }

        const newPkg = await tx.scenarioPackage.create({
          data: {
            name: packageData.packageName,
            code: uniqueCode,
            description: 'Imported via JSON',
            version: '1.0.0',
          }
        });
        targetPackageId = newPkg.id;

        // Create/Update Dimensions if provided
        if (Array.isArray(packageData.dimensions)) {
          for (const dim of packageData.dimensions) {
            // Check if dimension exists
            const existing = await tx.dimension.findUnique({
              where: { code: dim.name }
            });
            if (!existing) {
              await tx.dimension.create({
                data: {
                  code: dim.name,
                  name: dim.displayName || dim.name,
                  description: '',
                  category: 'Imported',
                }
              });
            }
          }
        }
      } else {
        if (!targetPackageId) {
          throw new Error('packageId is required when not creating a new package.');
        }
      }

      // Fetch all dimensions to map dimension codes (names) to dimension IDs
      const allDimensions = await tx.dimension.findMany();
      const dimMap = new Map(allDimensions.map(d => [d.code, d.id]));

      // 2. Iterate Scenarios and Options
      for (const sData of scenarios) {
        const scenario = await tx.scenario.create({
          data: {
            packageId: targetPackageId,
            sequenceOrder: sData.sequenceOrder || 1,
            narrativeText: sData.narrativeText,
            timeLimitSec: sData.timeLimitSec || 90,
          }
        });

        if (Array.isArray(sData.options)) {
          for (const oData of sData.options) {
            const option = await tx.scenarioOption.create({
              data: {
                scenarioId: scenario.id,
                optionCode: oData.label || 'X',
                optionText: oData.title || '',
              }
            });

            // Create OptionScores
            if (oData.scores && typeof oData.scores === 'object') {
              for (const [dimName, weight] of Object.entries(oData.scores)) {
                const dimId = dimMap.get(dimName);
                if (!dimId) {
                  throw new Error(`Dimension '${dimName}' not found in the database. Please ensure it is created first or included in the package dimensions.`);
                }
                
                await tx.optionScore.create({
                  data: {
                    optionId: option.id,
                    dimensionId: dimId,
                    weightScore: Number(weight),
                  }
                });
              }
            }
          }
        }
      }
    });

    return NextResponse.json({ success: true, packageId: targetPackageId }, { status: 201 });
  } catch (err: unknown) {
    console.error('[scenarios import]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import failed' }, { status: 500 });
  }
}
