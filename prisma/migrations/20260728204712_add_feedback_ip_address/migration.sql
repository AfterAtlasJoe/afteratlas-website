-- AlterTable
ALTER TABLE "feedback" ADD COLUMN     "ipAddress" TEXT;

-- CreateIndex
CREATE INDEX "feedback_ipAddress_createdAt_idx" ON "feedback"("ipAddress", "createdAt");
