import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentAdmin, hashPassword } from '@/lib/auth';

// GET /api/admin/admins - List all admins
export async function GET() {
  try {
    const currentAdmin = await getCurrentAdmin();
    if (!currentAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImageUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ admins, currentAdminId: currentAdmin.id, currentUserRole: currentAdmin.role });
  } catch (error) {
    console.error('Error fetching admins:', error);
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }
}

// POST /api/admin/admins - Create a new admin (Super Admin only)
export async function POST(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin();
    if (!currentAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (currentAdmin.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Administrators can create new administrators.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, password, name, role = 'ADMIN' } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Name, email, and password are required.' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'ASSESSOR'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role specified.' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An administrator with this email already exists.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const newAdmin = await prisma.admin.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role,
        passwordHash,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImageUrl: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ admin: newAdmin }, { status: 201 });
  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json({ error: 'Failed to create administrator' }, { status: 500 });
  }
}
