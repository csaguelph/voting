-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "merkleRoot" TEXT,
ADD COLUMN     "merkleTreeGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "merkleTreeVoteCount" INTEGER;
