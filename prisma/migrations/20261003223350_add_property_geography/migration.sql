/*
  Warnings:

  - Added the required column `constituencyId` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `countyId` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `wardId` to the `Property` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "constituencyId" TEXT NOT NULL,
ADD COLUMN     "countyId" TEXT NOT NULL,
ADD COLUMN     "marketerCoverageId" TEXT,
ADD COLUMN     "wardId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Property_countyId_idx" ON "Property"("countyId");

-- CreateIndex
CREATE INDEX "Property_constituencyId_idx" ON "Property"("constituencyId");

-- CreateIndex
CREATE INDEX "Property_wardId_idx" ON "Property"("wardId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "County"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_marketerCoverageId_fkey" FOREIGN KEY ("marketerCoverageId") REFERENCES "MarketerCoverage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
