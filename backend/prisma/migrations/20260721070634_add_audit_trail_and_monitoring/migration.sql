-- DropIndex
DROP INDEX "AuditLog_entityType_idx";

-- DropIndex
DROP INDEX "AuditLog_restaurantId_idx";

-- DropIndex
DROP INDEX "AuditLog_userId_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "hash" TEXT,
ADD COLUMN     "newValue" JSONB,
ADD COLUMN     "previousHash" TEXT,
ADD COLUMN     "previousValue" JSONB,
ADD COLUMN     "requestMethod" TEXT,
ADD COLUMN     "requestPath" TEXT,
ADD COLUMN     "severity" TEXT NOT NULL DEFAULT 'INFO';

-- CreateTable
CREATE TABLE "SystemMetric" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "metricType" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ms',
    "tags" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlowQueryLog" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "query" TEXT NOT NULL,
    "durationMs" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "correlationId" TEXT,
    "params" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlowQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemMetric_metricType_recordedAt_idx" ON "SystemMetric"("metricType", "recordedAt");

-- CreateIndex
CREATE INDEX "SystemMetric_restaurantId_metricType_recordedAt_idx" ON "SystemMetric"("restaurantId", "metricType", "recordedAt");

-- CreateIndex
CREATE INDEX "SystemMetric_recordedAt_idx" ON "SystemMetric"("recordedAt");

-- CreateIndex
CREATE INDEX "SlowQueryLog_durationMs_idx" ON "SlowQueryLog"("durationMs");

-- CreateIndex
CREATE INDEX "SlowQueryLog_recordedAt_idx" ON "SlowQueryLog"("recordedAt");

-- CreateIndex
CREATE INDEX "SlowQueryLog_source_idx" ON "SlowQueryLog"("source");

-- CreateIndex
CREATE INDEX "AuditLog_restaurantId_createdAt_idx" ON "AuditLog"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_restaurantId_action_idx" ON "AuditLog"("restaurantId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_restaurantId_entityType_idx" ON "AuditLog"("restaurantId", "entityType");

-- CreateIndex
CREATE INDEX "AuditLog_restaurantId_userId_idx" ON "AuditLog"("restaurantId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_restaurantId_severity_idx" ON "AuditLog"("restaurantId", "severity");
