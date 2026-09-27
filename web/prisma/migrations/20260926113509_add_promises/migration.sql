-- CreateEnum
CREATE TYPE "PromiseDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "PromiseStatus" AS ENUM ('ACTIVE', 'FULFILLED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Promise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" "PromiseDirection" NOT NULL,
    "personName" TEXT,
    "personEmail" TEXT,
    "commitment" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" "PromiseStatus" NOT NULL DEFAULT 'ACTIVE',
    "confidence" DOUBLE PRECISION,
    "sourceEmailId" TEXT,
    "relatedTaskId" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promise_relatedTaskId_key" ON "Promise"("relatedTaskId");

-- AddForeignKey
ALTER TABLE "Promise" ADD CONSTRAINT "Promise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promise" ADD CONSTRAINT "Promise_sourceEmailId_fkey" FOREIGN KEY ("sourceEmailId") REFERENCES "Email"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promise" ADD CONSTRAINT "Promise_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
