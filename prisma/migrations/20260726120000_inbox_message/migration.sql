-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'system',
    "fromName" TEXT NOT NULL,
    "fromUserId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkHref" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "InboxMessage_userId_createdAt_idx" ON "InboxMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InboxMessage_userId_readAt_idx" ON "InboxMessage"("userId", "readAt");
