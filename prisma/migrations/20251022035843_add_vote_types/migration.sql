-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('CANDIDATE', 'APPROVE', 'OPPOSE', 'ABSTAIN', 'YES', 'NO');

-- AlterTable
ALTER TABLE "votes" ADD COLUMN     "voteType" "VoteType" NOT NULL DEFAULT 'CANDIDATE',
ALTER COLUMN "candidateId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "votes_voteType_idx" ON "votes"("voteType");
