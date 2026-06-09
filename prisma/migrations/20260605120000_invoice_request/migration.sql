-- CreateTable
CREATE TABLE "InvoiceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNo" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "walletTransactionId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceRequest_invoiceNo_key" ON "InvoiceRequest"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceRequest_walletTransactionId_key" ON "InvoiceRequest"("walletTransactionId");

-- CreateIndex
CREATE INDEX "InvoiceRequest_clientId_idx" ON "InvoiceRequest"("clientId");
