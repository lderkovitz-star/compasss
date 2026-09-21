import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentAdmin, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PATCH /api/admin/admins/[id] - Update admin details, role, status, or password
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentAdmin = await getCurrentAdmin();
    if (!currentAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (currentAdmin.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Administrators can modify administrator roles and permissions.' },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { name, role, isActive, password } = body;

    const targetAdmin = await prisma.admin.findUnique({
      where: { id },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });
    }

    // Safety: Prevent demoting or deactivating the last active SUPER_ADMIN
    if (
      (role && role !== 'SUPER_ADMIN' && targetAdmin.role === 'SUPER_ADMIN') ||
      (isActive === false && targetAdmin.role === 'SUPER_ADMIN')
    ) {
      const superAdminCount = await prisma.admin.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
      });
      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote or deactivate the only active Super Administrator.' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (role !== undefined) {
      const validRoles = ['SUPER_ADMIN', 'ADMIN', 'ASSESSOR'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
      }
      updateData.role = role;
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (password && password.length >= 6) {
      updateData.passwordHash = await hashPassword(password);
    }

    const updated = await prisma.admin.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImageUrl: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ admin: updated });
  } catch (error) {
    console.error('Error updating admin:', error);
    return NextResponse.json({ error: 'Failed to update administrator' }, { status: 500 });
  }
}

// DELETE /api/admin/admins/[id] - Permanently remove an admin account
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentAdmin = await getCurrentAdmin();
    if (!currentAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (currentAdmin.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Administrators can delete administrator accounts.' },
        { status: 403 }
      );
    }

    const { id } = params;

    if (id === currentAdmin.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account.' },
        { status: 400 }
      );
    }

    const targetAdmin = await prisma.admin.findUnique({
      where: { id },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });
    }

    if (targetAdmin.role === 'SUPER_ADMIN') {
      const superAdminCount = await prisma.admin.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
      });
      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the only Super Administrator.' },
          { status: 400 }
        );
      }
    }

    await prisma.admin.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting admin:', error);
    return NextResponse.json({ error: 'Failed to delete administrator' }, { status: 500 });
  }
}
