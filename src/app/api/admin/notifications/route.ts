import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

// GET all notifications
export async function GET() {
  const adminEmail = getAdminSession();
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50, // limit to 50
    });
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// PATCH to mark all as read
export async function PATCH() {
  const adminEmail = getAdminSession();
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}

// DELETE to clear all notifications
export async function DELETE() {
  const adminEmail = getAdminSession();
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.notification.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return NextResponse.json({ error: 'Failed to clear notifications' }, { status: 500 });
  }
}
