/**
 * Quick debug script to test receipt creation directly
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Test 1: Find any restaurant
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      console.log('No restaurant found');
      return;
    }
    console.log('Restaurant:', restaurant.id, restaurant.name);

    // Test 2: Try findUnique on DocumentSequence
    try {
      const seq = await prisma.documentSequence.findUnique({
        where: {
          restaurantId_sequenceType_businessDate: {
            restaurantId: restaurant.id,
            sequenceType: 'TEST',
            businessDate: '20260716',
          },
        },
      });
      console.log('findUnique test:', seq ? 'found' : 'not found (null)');
    } catch (err: any) {
      console.log('findUnique ERROR:', err.message);
      if (err.code) console.log('Error code:', err.code);
    }

    // Test 3: Try create a stock receipt
    const location = await prisma.stockLocation.findFirst({ where: { restaurantId: restaurant.id } });
    const user = await prisma.user.findFirst({ where: { restaurantId: restaurant.id } });

    if (location && user) {
      console.log('Location:', location.id, location.name);
      console.log('User:', user.id, user.email);

      // Test receipt number generation
      const sequenceNumber = `TEST-${Date.now()}`;
      console.log('Seq number:', sequenceNumber);

      try {
        const receipt = await prisma.stockReceipt.create({
          data: {
            restaurantId: restaurant.id,
            receiptNumber: sequenceNumber,
            stockLocationId: location.id,
            receiptDate: new Date(),
            createdById: user.id,
            subtotalCost: 0,
            totalCost: 0,
          },
        });
        console.log('Receipt created:', receipt.id, receipt.receiptNumber);
      } catch (err: any) {
        console.log('CREATE RECEIPT ERROR:', err.message);
      }
    } else {
      console.log('Missing location or user');
    }
  } catch (err: any) {
    console.log('GLOBAL ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
