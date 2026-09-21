import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { put } from '@vercel/blob';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_SIZE_MB = 5;

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null; // 'backdrop' | 'logo'

    if (!file || !type) {
      return NextResponse.json({ error: 'file and type are required.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, WebP, GIF, SVG files allowed.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File must be under ${MAX_SIZE_MB}MB.` }, { status: 400 });
    }

    const ext = file.name.split('.').pop() ?? 'jpg';
    const fileName = `${type}-${Date.now()}.${ext}`;
    const blob = await put(`media/${fileName}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    const url = blob.url;

    // Optionally update default backdrop / logo in platform settings
    if (type === 'backdrop' || type === 'logo') {
      const settings = await prisma.platformSettings.findFirst();
      if (settings) {
        await prisma.platformSettings.update({
          where: { id: settings.id },
          data: type === 'backdrop' ? { defaultBackdropUrl: url } : { logoUrl: url },
        });
      }
    }

    return NextResponse.json({ url, fileName });
  } catch (err) {
    console.error('[media upload]', err);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
