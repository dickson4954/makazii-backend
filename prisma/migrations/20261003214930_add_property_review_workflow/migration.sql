-- AlterEnum
ALTER TYPE "PropertyStatus" ADD VALUE 'CHANGES_REQUIRED';

-- AlterTable
ALTER TABLE "PropertyStatusHistory" ADD COLUMN     "changedById" TEXT;

-- CreateIndex
CREATE INDEX "PropertyStatusHistory_changedById_idx" ON "PropertyStatusHistory"("changedById");
