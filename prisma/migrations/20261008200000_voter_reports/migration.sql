-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SOMEONE_ELSE_VOTED', 'ASKED_FOR_ACCESS', 'PRESSURED', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportSource" AS ENUM ('SUBMISSION', 'RECEIPT', 'ALREADY_VOTED', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "voter_reports" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "voterId" TEXT,
    "voterName" TEXT NOT NULL,
    "voterEmail" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT NOT NULL,
    "source" "ReportSource" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voter_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voter_reports_electionId_status_idx" ON "voter_reports"("electionId", "status");

-- CreateIndex
CREATE INDEX "voter_reports_voterId_idx" ON "voter_reports"("voterId");

-- AddForeignKey
ALTER TABLE "voter_reports" ADD CONSTRAINT "voter_reports_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_reports" ADD CONSTRAINT "voter_reports_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "eligible_voters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

