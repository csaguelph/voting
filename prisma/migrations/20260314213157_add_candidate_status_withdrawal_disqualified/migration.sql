-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'DISQUALIFIED');

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "status" "CandidateStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "statusReason" TEXT;

-- CreateIndex
CREATE INDEX "candidates_status_idx" ON "candidates"("status");
