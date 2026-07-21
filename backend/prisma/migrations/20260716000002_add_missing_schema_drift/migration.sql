-- Add enum values that were present in schema/database but missing from migration history.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LOW_STOCK';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESERVATION_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WAITER_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPROVAL_NEEDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TIP_RECEIVED';

-- Preserve table fields introduced outside the migration chain.
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "tipAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;

ALTER TABLE "RestaurantTable" ADD COLUMN IF NOT EXISTS "assignedWaiterId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RestaurantTable_assignedWaiterId_fkey'
  ) THEN
    ALTER TABLE "RestaurantTable"
      ADD CONSTRAINT "RestaurantTable_assignedWaiterId_fkey"
      FOREIGN KEY ("assignedWaiterId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
