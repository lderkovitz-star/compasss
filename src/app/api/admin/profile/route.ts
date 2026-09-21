import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { getAdminSession, hashPassword } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET — fetch admin profile
export async function GET() {
  const adminEmail = getAdminSession();
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

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
  const adminEmail = getAdminSession();
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

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

      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'admin');
      await mkdir(uploadDir, { recursive: true });
      const ext = imageFile.name.split('.').pop() || 'jpg';
      const fileName = `admin-${Date.now()}.${ext}`;
      const bytes = await imageFile.arrayBuffer();
      await writeFile(path.join(uploadDir, fileName), Buffer.from(bytes));
      const profileImageUrl = `/uploads/admin/${fileName}`;

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
    const valid = await bcrypt.compare(body.currentPassword, admin.passwordHash);
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
