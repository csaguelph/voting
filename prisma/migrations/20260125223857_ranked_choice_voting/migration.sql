/*
  Warnings:

  - You are about to drop the column `candidateId` on the `votes` table. All the data in the column will be lost.
  - You are about to drop the column `voteType` on the `votes` table. All the data in the column will be lost.
  - Made the column `studentIdHash` on table `eligible_voters` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `voteData` to the `votes` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."votes" DROP CONSTRAINT "votes_candidateId_fkey";

-- DropIndex
DROP INDEX "public"."votes_candidateId_idx";

-- DropIndex
DROP INDEX "public"."votes_voteType_idx";

-- AlterTable
ALTER TABLE "eligible_voters" ALTER COLUMN "studentIdHash" SET NOT NULL;

-- AlterTable
ALTER TABLE "votes" DROP COLUMN "candidateId",
DROP COLUMN "voteType",
ADD COLUMN     "voteData" JSONB NOT NULL;

-- DropEnum
DROP TYPE "public"."VoteType";
