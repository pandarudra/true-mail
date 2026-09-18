-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "important" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "spam" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trashedAt" TIMESTAMP(3);
