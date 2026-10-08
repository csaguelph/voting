-- AlterTable
ALTER TABLE "eligible_voters" ADD COLUMN     "identityCheckFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "identityConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "identityLockedUntil" TIMESTAMP(3);
