-- CreateEnum
CREATE TYPE "BallotType" AS ENUM ('EXECUTIVE', 'DIRECTOR');

-- CreateTable
CREATE TABLE "elections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ballots" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "BallotType" NOT NULL,
    "college" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ballots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "ballotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "statement" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "ballotId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "voteHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligible_voters" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "college" TEXT NOT NULL,
    "hasVoted" BOOLEAN NOT NULL DEFAULT false,
    "votedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eligible_voters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "elections_isActive_idx" ON "elections"("isActive");

-- CreateIndex
CREATE INDEX "elections_startTime_idx" ON "elections"("startTime");

-- CreateIndex
CREATE INDEX "elections_endTime_idx" ON "elections"("endTime");

-- CreateIndex
CREATE INDEX "ballots_electionId_idx" ON "ballots"("electionId");

-- CreateIndex
CREATE INDEX "ballots_type_idx" ON "ballots"("type");

-- CreateIndex
CREATE INDEX "ballots_college_idx" ON "ballots"("college");

-- CreateIndex
CREATE INDEX "candidates_ballotId_idx" ON "candidates"("ballotId");

-- CreateIndex
CREATE UNIQUE INDEX "votes_voteHash_key" ON "votes"("voteHash");

-- CreateIndex
CREATE INDEX "votes_electionId_idx" ON "votes"("electionId");

-- CreateIndex
CREATE INDEX "votes_ballotId_idx" ON "votes"("ballotId");

-- CreateIndex
CREATE INDEX "votes_candidateId_idx" ON "votes"("candidateId");

-- CreateIndex
CREATE INDEX "votes_voteHash_idx" ON "votes"("voteHash");

-- CreateIndex
CREATE INDEX "eligible_voters_electionId_idx" ON "eligible_voters"("electionId");

-- CreateIndex
CREATE INDEX "eligible_voters_email_idx" ON "eligible_voters"("email");

-- CreateIndex
CREATE INDEX "eligible_voters_studentId_idx" ON "eligible_voters"("studentId");

-- CreateIndex
CREATE INDEX "eligible_voters_college_idx" ON "eligible_voters"("college");

-- CreateIndex
CREATE INDEX "eligible_voters_hasVoted_idx" ON "eligible_voters"("hasVoted");

-- CreateIndex
CREATE UNIQUE INDEX "eligible_voters_electionId_email_key" ON "eligible_voters"("electionId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "eligible_voters_electionId_studentId_key" ON "eligible_voters"("electionId", "studentId");

-- CreateIndex
CREATE INDEX "audit_logs_electionId_idx" ON "audit_logs"("electionId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "ballots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "ballots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligible_voters" ADD CONSTRAINT "eligible_voters_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
