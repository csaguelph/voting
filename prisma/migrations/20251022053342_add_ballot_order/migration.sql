-- AlterTable
ALTER TABLE "ballots" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ballots_electionId_order_idx" ON "ballots"("electionId", "order");
