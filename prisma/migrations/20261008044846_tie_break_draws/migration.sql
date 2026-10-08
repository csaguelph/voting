-- CreateEnum
CREATE TYPE "TieBreakKind" AS ENUM ('EXCLUSION', 'SEAT');

-- CreateTable
CREATE TABLE "tie_break_draws" (
    "id" TEXT NOT NULL,
    "ballotId" TEXT NOT NULL,
    "kind" "TieBreakKind" NOT NULL,
    "round" INTEGER NOT NULL,
    "candidateIds" TEXT[],
    "selectedCandidateIds" TEXT[],
    "decidedById" TEXT NOT NULL,
    "decidedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tie_break_draws_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tie_break_draws_ballotId_kind_round_key" ON "tie_break_draws"("ballotId", "kind", "round");

-- AddForeignKey
ALTER TABLE "tie_break_draws" ADD CONSTRAINT "tie_break_draws_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "ballots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
