const path = require('path');
const bcrypt = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'bcrypt'));
const { PrismaClient } = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', '@prisma', 'client'));

const prisma = new PrismaClient();

const users = [
  {
    email: 'cashier@savannabistro.com',
    firstName: 'Grace',
    lastName: 'Ishimwe',
    phone: '+250 788 111 007',
    employeeCode: 'EMP007',
    roles: ['CASHIER'],
  },
  {
    email: 'stock@savannabistro.com',
    firstName: 'Herve',
    lastName: 'Nsengiyumva',
    phone: '+250 788 111 008',
    employeeCode: 'EMP008',
    roles: ['STOCK_KEEPER'],
  },
];

async function main() {
  const restaurant = await prisma.restaurant.findFirst();
  if (!restaurant) {
    throw new Error('Seeded restaurant was not found. Run npm run db:seed first.');
  }

  await prisma.restaurantSettings.upsert({
    where: { restaurantId: restaurant.id },
    create: {
      restaurantId: restaurant.id,
      qrTableOrderingEnabled: true,
      dineInQrOrderingEnabled: true,
      publicWebsiteEnabled: true,
      publicOrderingEnabled: true,
      publicReservationsEnabled: true,
    },
    update: {
      qrTableOrderingEnabled: true,
      dineInQrOrderingEnabled: true,
      publicWebsiteEnabled: true,
      publicOrderingEnabled: true,
      publicReservationsEnabled: true,
    },
  });

  const passwordHash = await bcrypt.hash('password123', 12);

  for (const roleName of ['CASHIER', 'STOCK_KEEPER']) {
    await prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName, description: `${roleName.replace(/_/g, ' ')} role`, isSystemRole: true },
      update: {},
    });
  }

  for (const userSeed of users) {
    const user = await prisma.user.upsert({
      where: { email: userSeed.email },
      create: {
        restaurantId: restaurant.id,
        firstName: userSeed.firstName,
        lastName: userSeed.lastName,
        email: userSeed.email,
        phone: userSeed.phone,
        employeeCode: userSeed.employeeCode,
        passwordHash,
        status: 'ACTIVE',
      },
      update: {
        restaurantId: restaurant.id,
        firstName: userSeed.firstName,
        lastName: userSeed.lastName,
        phone: userSeed.phone,
        employeeCode: userSeed.employeeCode,
        passwordHash,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
        mustChangePassword: false,
      },
    });

    for (const roleName of userSeed.roles) {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      });
    }
  }

  const table = await prisma.restaurantTable.findFirst({ where: { restaurantId: restaurant.id, isActive: true } });
  if (!table) throw new Error('No active table found for QR E2E setup.');

  await prisma.tableQrToken.updateMany({
    where: {
      restaurantId: restaurant.id,
      OR: [{ tokenPrefix: 'e2eqr01' }, { tokenHash: 'e2e-test-token-hash' }, { tableId: table.id, isActive: true }],
    },
    data: { isActive: false, revokedAt: new Date() },
  });
  const existingQrToken = await prisma.tableQrToken.findFirst({
    where: { restaurantId: restaurant.id, tokenHash: 'e2e-test-token-hash' },
  });
  if (existingQrToken) {
    await prisma.tableQrToken.update({
      where: { id: existingQrToken.id },
      data: {
        tableId: table.id,
        tokenPrefix: 'e2eqr01',
        isActive: true,
        revokedAt: null,
      },
    });
  } else {
    await prisma.tableQrToken.create({
      data: {
        restaurantId: restaurant.id,
        tableId: table.id,
        tokenPrefix: 'e2eqr01',
        tokenHash: 'e2e-test-token-hash',
        isActive: true,
      },
    });
  }
}

main()
  .then(() => console.log('E2E role users are ready.'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
