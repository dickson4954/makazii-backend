/*
  Warnings:

  - Added the required column `constituencyId` to the `MarketerApplication` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MarketerApplication" ADD COLUMN     "constituencyId" TEXT NOT NULL,
ADD COLUMN     "wardIds" TEXT[];

-- CreateTable
CREATE TABLE "MarketerCoverage" (
    "id" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "countyId" TEXT NOT NULL,
    "constituencyId" TEXT NOT NULL,
    "wardIds" TEXT[],
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketerCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketerCoverage_marketerId_key" ON "MarketerCoverage"("marketerId");

-- CreateIndex
CREATE INDEX "MarketerCoverage_countyId_idx" ON "MarketerCoverage"("countyId");

-- CreateIndex
CREATE INDEX "MarketerCoverage_constituencyId_idx" ON "MarketerCoverage"("constituencyId");

-- CreateIndex
CREATE INDEX "MarketerApplication_constituencyId_idx" ON "MarketerApplication"("constituencyId");

-- AddForeignKey
ALTER TABLE "MarketerCoverage" ADD CONSTRAINT "MarketerCoverage_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "Marketer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketerCoverage" ADD CONSTRAINT "MarketerCoverage_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "County"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketerCoverage" ADD CONSTRAINT "MarketerCoverage_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
