-- AlterEnum
ALTER TYPE "BallotType" ADD VALUE 'REFERENDUM';

-- AlterTable
ALTER TABLE "ballots" ADD COLUMN     "preamble" TEXT,
ADD COLUMN     "question" TEXT,
ADD COLUMN     "sponsor" TEXT;
