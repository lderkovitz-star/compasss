import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';
import {
  parsePackJson,
  parsePackCsv,
  previewPack,
  writePack,
  PackConflictError,
  type ParseResult,
} from '@/lib/pack-import';

export const dynamic = 'force-dynamic';
// A 200-scenario pack takes a while to write; well inside Vercel's limit but
// past the default.
export const maxDuration = 120;

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Pack upload.
 *
 * Two phases, because an import that half-succeeds is worse than one that is
 * refused: `dryRun` parses the file, reports counts and every problem it found,
 * and writes nothing. The same request without `dryRun` writes it.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const contentType = req.headers.get('content-type') ?? '';
    let parsed: ParseResult;
    let dryRun = true;
    let replaceExisting = false;
    let overrides: { name?: string; code?: string; description?: string } = {};

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 8 MB.` },
          { status: 413 }
        );
      }

      const text = await file.text();
      dryRun = form.get('dryRun') !== 'false';
      replaceExisting = form.get('replaceExisting') === 'true';
      overrides = {
        name: str(form.get('packageName')),
        code: str(form.get('packageCode')),
        description: str(form.get('packageDescription')),
      };

      const isCsv = file.name.toLowerCase().endsWith('.csv') || contentType.includes('text/csv');
      if (isCsv) {
        parsed = parsePackCsv(text, overrides.name || file.name.replace(/\.csv$/i, ''));
      } else {
        try {
          parsed = parsePackJson(JSON.parse(text));
        } catch {
          return NextResponse.json(
            { error: 'That file is not valid JSON. Check it in an editor, or upload a CSV instead.' },
            { status: 400 }
          );
        }
      }
    } else {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
      }
      const envelope = body as Record<string, unknown>;
      dryRun = envelope.dryRun !== false;
      replaceExisting = envelope.replaceExisting === true;
      overrides = {
        name: str(envelope.packageName),
        code: str(envelope.packageCode),
        description: str(envelope.packageDescription),
      };

      if (typeof envelope.csv === 'string') {
        parsed = parsePackCsv(envelope.csv, overrides.name);
      } else {
        parsed = parsePackJson(envelope.pack ?? envelope);
      }
    }

    const errors = parsed.issues.filter((i) => i.severity === 'error');

    if (!parsed.pack) {
      return NextResponse.json(
        { ok: false, issues: parsed.issues, error: 'Nothing in that file could be imported.' },
        { status: 400 }
      );
    }

    // The uploader may rename the pack without the file being edited.
    if (overrides.name) parsed.pack.package.name = overrides.name;
    if (overrides.code) parsed.pack.package.code = overrides.code.toUpperCase();
    if (overrides.description) parsed.pack.package.description = overrides.description;

    const preview = await previewPack(prisma, parsed.pack, parsed.issues);

    if (dryRun) {
      return NextResponse.json({ ok: errors.length === 0, dryRun: true, preview });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          preview,
          error: `${errors.length} problem${errors.length === 1 ? '' : 's'} must be fixed before this pack can be imported.`,
        },
        { status: 400 }
      );
    }

    if (preview.codeInUse && !replaceExisting) {
      return NextResponse.json(
        {
          ok: false,
          preview,
          error: `Package code "${preview.packageCode}" already exists. Confirm replacing its contents, or give the pack a different code.`,
        },
        { status: 409 }
      );
    }

    const result = await writePack(prisma, parsed.pack, { replaceExisting });

    await prisma.auditLog.create({
      data: {
        actorType: 'ADMIN',
        actorId: auth.id,
        action: 'pack.import',
        targetType: 'ScenarioPackage',
        targetId: result.packageId,
        meta: {
          code: result.packageCode,
          created: result.scenariosCreated,
          updated: result.scenariosUpdated,
          retired: result.scenariosRetired,
          options: result.options,
          scores: result.scores,
          dimensionsCreated: result.dimensionsCreated,
        },
      },
    });

    return NextResponse.json({ ok: true, result, preview }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof PackConflictError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
    }
    console.error('[scenarios import]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed.' },
      { status: 500 }
    );
  }
}

function str(value: FormDataEntryValue | unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
