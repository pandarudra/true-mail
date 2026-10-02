-- Add Gmail integration: GmailConnection table, Mailbox.source + nullable domainId, Email.gmailMessageId

-- Make Mailbox.domainId nullable (existing rows keep their value)
ALTER TABLE "Mailbox" ALTER COLUMN "domainId" DROP NOT NULL;

-- Add source column to Mailbox (existing rows default to "resend")
ALTER TABLE "Mailbox" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'resend';

-- Add gmailMessageId to Email for deduplication
ALTER TABLE "Email" ADD COLUMN "gmailMessageId" TEXT;
CREATE UNIQUE INDEX "Email_gmailMessageId_key" ON "Email"("gmailMessageId");

-- Create GmailConnection table
CREATE TABLE "GmailConnection" (
    "id"                    TEXT NOT NULL,
    "userId"                TEXT NOT NULL,
    "mailboxId"             TEXT NOT NULL,
    "gmailEmail"            TEXT NOT NULL,
    "encryptedAccessToken"  TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt"  TIMESTAMP(3) NOT NULL,
    "lastSyncedAt"          TIMESTAMP(3),
    "historyId"             TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GmailConnection_userId_key"    ON "GmailConnection"("userId");
CREATE UNIQUE INDEX "GmailConnection_mailboxId_key" ON "GmailConnection"("mailboxId");

ALTER TABLE "GmailConnection"
    ADD CONSTRAINT "GmailConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmailConnection"
    ADD CONSTRAINT "GmailConnection_mailboxId_fkey"
    FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
