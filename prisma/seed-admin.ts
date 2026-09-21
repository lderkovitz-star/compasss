import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.');
  }
  const hash = await bcrypt.hash(password, 12);

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin already exists, updating password hash...');
    await prisma.admin.update({
      where: { email },
      data: { passwordHash: hash, role: 'SUPER_ADMIN', isActive: true },
    });
  } else {
    await prisma.admin.create({
      data: {
        email,
        passwordHash: hash,
        role: 'SUPER_ADMIN',
      },
    });
  }

  console.log(`Super admin seeded: ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
