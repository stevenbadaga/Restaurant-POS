-- CreateEnum
CREATE TYPE "PrinterConnectionType" AS ENUM ('USB', 'NETWORK', 'BLUETOOTH', 'BROWSER');

-- CreateEnum
CREATE TYPE "PrinterStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrintJobType" AS ENUM ('RECEIPT', 'KITCHEN_TICKET', 'X_REPORT', 'Z_REPORT', 'ORDER_SUMMARY', 'OTHER');

-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "connectionType" "PrinterConnectionType" NOT NULL DEFAULT 'BROWSER',
    "ipAddress" TEXT,
    "port" INTEGER,
    "paperSize" "ReceiptPaperSize" NOT NULL DEFAULT 'THERMAL_80MM',
    "status" "PrinterStatus" NOT NULL DEFAULT 'ONLINE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "autoPrintReceipt" BOOLEAN NOT NULL DEFAULT false,
    "autoPrintTicket" BOOLEAN NOT NULL DEFAULT false,
    "kitchenStationId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "printerId" TEXT,
    "jobType" "PrintJobType" NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "content" TEXT,
    "contentType" TEXT NOT NULL DEFAULT 'text/html',
    "copies" INTEGER NOT NULL DEFAULT 1,
    "paperSize" "ReceiptPaperSize" NOT NULL DEFAULT 'THERMAL_80MM',
    "entityType" TEXT,
    "entityId" TEXT,
    "orderId" TEXT,
    "ticketId" TEXT,
    "receiptId" TEXT,
    "requestedById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Printer_restaurantId_idx" ON "Printer"("restaurantId");

-- CreateIndex
CREATE INDEX "Printer_restaurantId_isActive_idx" ON "Printer"("restaurantId", "isActive");

-- CreateIndex
CREATE INDEX "Printer_kitchenStationId_idx" ON "Printer"("kitchenStationId");

-- CreateIndex
CREATE UNIQUE INDEX "Printer_restaurantId_name_key" ON "Printer"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "PrintJob_restaurantId_idx" ON "PrintJob"("restaurantId");

-- CreateIndex
CREATE INDEX "PrintJob_printerId_idx" ON "PrintJob"("printerId");

-- CreateIndex
CREATE INDEX "PrintJob_orderId_idx" ON "PrintJob"("orderId");

-- CreateIndex
CREATE INDEX "PrintJob_ticketId_idx" ON "PrintJob"("ticketId");

-- CreateIndex
CREATE INDEX "PrintJob_receiptId_idx" ON "PrintJob"("receiptId");

-- CreateIndex
CREATE INDEX "PrintJob_status_idx" ON "PrintJob"("status");

-- CreateIndex
CREATE INDEX "PrintJob_createdAt_idx" ON "PrintJob"("createdAt");

-- AddForeignKey
ALTER TABLE "Printer" ADD CONSTRAINT "Printer_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Printer" ADD CONSTRAINT "Printer_kitchenStationId_fkey" FOREIGN KEY ("kitchenStationId") REFERENCES "KitchenStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
