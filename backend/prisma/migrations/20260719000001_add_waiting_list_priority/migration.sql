ALTER TABLE "WaitingListEntry" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "WaitingListEntry_priority_idx" ON "WaitingListEntry"("priority");
