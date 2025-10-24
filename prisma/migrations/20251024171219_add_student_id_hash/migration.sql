/*
  Warnings:

  - A unique constraint covering the columns `[electionId,studentIdHash]` on the table `eligible_voters` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `studentIdHash` to the `eligible_voters` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "eligible_voters" ADD COLUMN     "studentIdHash" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "eligible_voters_studentIdHash_idx" ON "eligible_voters"("studentIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "eligible_voters_electionId_studentIdHash_key" ON "eligible_voters"("electionId", "studentIdHash");
