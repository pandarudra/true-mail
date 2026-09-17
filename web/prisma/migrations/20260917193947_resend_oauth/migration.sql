/*
  Warnings:

  - You are about to drop the column `encryptedApiKey` on the `ResendConnection` table. All the data in the column will be lost.
  - Added the required column `accessTokenExpiresAt` to the `ResendConnection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedAccessToken` to the `ResendConnection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedRefreshToken` to the `ResendConnection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scope` to the `ResendConnection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ResendConnection" DROP COLUMN "encryptedApiKey",
ADD COLUMN     "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "encryptedAccessToken" TEXT NOT NULL,
ADD COLUMN     "encryptedRefreshToken" TEXT NOT NULL,
ADD COLUMN     "scope" TEXT NOT NULL;
