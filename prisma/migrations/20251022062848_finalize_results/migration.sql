-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "isFinalized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "elections_isFinalized_idx" ON "elections"("isFinalized");

-- CreateIndex
CREATE INDEX "elections_isPublished_idx" ON "elections"("isPublished");
