import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { requireAdmin, hashPassword } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET — fetch admin profile
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  return NextResponse.json({
    id: admin.id,
    email: admin.email,
    name: admin.name || 'Admin',
    role: admin.role || 'ADMIN',
    profileImageUrl: admin.profileImageUrl,
    createdAt: admin.createdAt,
  });
}

// PUT — update admin profile (email, password, image)
export async function PUT(req: NextRequest) {
  const caller = await requireAdmin();
  if (caller instanceof NextResponse) return caller;

  // The guard already fetched the account, so this edits whoever is signed
  // in - never an id the request supplied.
  const admin = caller;

  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    // Handle image upload
    const formData = await req.formData();
    const imageFile = formData.get('profileImage') as File | null;

    if (imageFile && imageFile.size > 0) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(imageFile.type)) {
        return NextResponse.json({ error: 'Image must be JPG, PNG, WebP, or GIF.' }, { status: 400 });
      }
      if (imageFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image must be under 5MB.' }, { status: 400 });
      }

      // Written to blob storage, not to disk. The filesystem on Vercel is
      // read-only, so this threw every time in production - the same fault
      // that was fixed for résumés and missed here. It also wrote into
      // public/uploads, which is how candidate documents ended up committed.
      const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const blob = await put(`admin/avatars/${admin.id}-${Date.now()}.${ext}`, imageFile, {
        access: 'public',
        addRandomSuffix: true,
        contentType: imageFile.type,
      });
      const profileImageUrl = blob.url;

      await prisma.admin.update({
        where: { id: admin.id },
        data: { profileImageUrl },
      });

      return NextResponse.json({ profileImageUrl });
    }

    return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
  }

  // Handle JSON body for email/password update
  const body = await req.json();
  const updateData: Record<string, string> = {};

  if (body.email && body.email !== admin.email) {
    // Check if new email is already taken
    const existing = await prisma.admin.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) return NextResponse.json({ error: 'Email already in use.' }, { status: 409 });
    updateData.email = body.email.toLowerCase();
  }

  if (body.currentPassword && body.newPassword) {
    // The guard returns a safe subset of the account, so the hash is read
    // separately - by the signed-in admin's id, never by anything the
    // request supplied.
    const credentials = await prisma.admin.findUnique({
      where: { id: admin.id },
      select: { passwordHash: true },
    });
    if (!credentials) {
      return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });
    }
    const valid = await bcrypt.compare(body.currentPassword, credentials.passwordHash);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 403 });
    if (body.newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
    }
    updateData.passwordHash = await hashPassword(body.newPassword);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No changes to save.' }, { status: 400 });
  }

  await prisma.admin.update({ where: { id: admin.id }, data: updateData });

  return NextResponse.json({ ok: true, emailChanged: !!updateData.email });
}
