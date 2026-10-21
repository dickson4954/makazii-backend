/*
  Warnings:

  - A unique constraint covering the columns `[sourceId]` on the table `Constituency` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sourceId]` on the table `County` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sourceId]` on the table `Ward` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Constituency" ADD COLUMN     "sourceId" TEXT;

-- AlterTable
ALTER TABLE "County" ADD COLUMN     "sourceId" TEXT;

-- AlterTable
ALTER TABLE "Ward" ADD COLUMN     "sourceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Constituency_sourceId_key" ON "Constituency"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "County_sourceId_key" ON "County"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_sourceId_key" ON "Ward"("sourceId");
