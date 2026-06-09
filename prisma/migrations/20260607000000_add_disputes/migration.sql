-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "raisedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Dispute_orderId_idx" ON "Dispute"("orderId");
CREATE INDEX "Dispute_clientId_idx" ON "Dispute"("clientId");
CREATE INDEX "Dispute_designerId_idx" ON "Dispute"("designerId");
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");
