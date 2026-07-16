import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  { name: 'ADMIN', description: 'Full system access and control' },
  { name: 'MANAGER', description: 'Manage restaurant operations' },
  { name: 'WAITER', description: 'Handle tables and orders' },
  { name: 'CHEF', description: 'View and manage kitchen orders' },
  { name: 'CASHIER', description: 'Process payments and generate receipts' },
  { name: 'STOCK_KEEPER', description: 'Manage inventory and stock' },
];

async function seed(): Promise<void> {
  console.log('🌱 Seeding database...');

  for (const role of roles) {
    const existing = await prisma.role.findUnique({
      where: { name: role.name },
    });

    if (!existing) {
      await prisma.role.create({ data: role });
      console.log(`  ✅ Role "${role.name}" created`);
    } else {
      console.log(`  ℹ️  Role "${role.name}" already exists`);
    }
  }

  console.log('✅ Seeding complete.');
}

seed()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
