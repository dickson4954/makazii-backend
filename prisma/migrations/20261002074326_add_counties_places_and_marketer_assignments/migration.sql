/*
  Warnings:

  - You are about to drop the column `region` on the `Marketer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Marketer" DROP COLUMN "region";

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "placeId" TEXT;

-- CreateTable
CREATE TABLE "County" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "County_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketerPlace" (
    "marketerId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketerPlace_pkey" PRIMARY KEY ("marketerId","placeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "County_name_key" ON "County"("name");

-- CreateIndex
CREATE INDEX "County_name_idx" ON "County"("name");

-- CreateIndex
CREATE INDEX "Place_countyId_idx" ON "Place"("countyId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_countyId_name_key" ON "Place"("countyId", "name");

-- CreateIndex
CREATE INDEX "MarketerPlace_placeId_idx" ON "MarketerPlace"("placeId");

-- CreateIndex
CREATE INDEX "Property_placeId_idx" ON "Property"("placeId");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "County"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketerPlace" ADD CONSTRAINT "MarketerPlace_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "Marketer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketerPlace" ADD CONSTRAINT "MarketerPlace_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
