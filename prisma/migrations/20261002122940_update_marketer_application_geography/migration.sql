/*
  Warnings:

  - You are about to drop the column `county` on the `MarketerApplication` table. All the data in the column will be lost.
  - You are about to drop the column `places` on the `MarketerApplication` table. All the data in the column will be lost.
  - Added the required column `countyId` to the `MarketerApplication` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "MarketerApplication_county_idx";

-- AlterTable
ALTER TABLE "MarketerApplication" DROP COLUMN "county",
DROP COLUMN "places",
ADD COLUMN     "countyId" TEXT NOT NULL,
ADD COLUMN     "placeIds" TEXT[];

-- CreateIndex
CREATE INDEX "MarketerApplication_countyId_idx" ON "MarketerApplication"("countyId");
