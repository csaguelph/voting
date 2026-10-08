-- CreateEnum
CREATE TYPE "TieBreakKind" AS ENUM ('EXCLUSION', 'SEAT');

-- CreateEnum
CREATE TYPE "TieBreakRule" AS ENUM ('LEGACY', 'AUSTRALIAN');

-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "tieBreakRule" "TieBreakRule" NOT NULL DEFAULT 'AUSTRALIAN';

-- Elections already finalized were counted under the previous tie-break
-- behaviour. Keep it for them so their published outcomes never change.
UPDATE "elections" SET "tieBreakRule" = 'LEGACY' WHERE "isFinalized" = true;

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
CREATE UNIQUE INDEX "tie_break_draws_ballotId_kind_round_candidateIds_key" ON "tie_break_draws"("ballotId", "kind", "round", "candidateIds");

-- AddForeignKey
ALTER TABLE "tie_break_draws" ADD CONSTRAINT "tie_break_draws_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "ballots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
