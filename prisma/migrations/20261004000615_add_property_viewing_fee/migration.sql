-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "viewingFee" INTEGER;

-- CreateIndex
CREATE INDEX "Property_viewingFee_idx" ON "Property"("viewingFee");
