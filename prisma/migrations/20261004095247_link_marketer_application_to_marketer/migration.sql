/*
  Warnings:

  - A unique constraint covering the columns `[marketerId]` on the table `MarketerApplication` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MarketerApplication" ADD COLUMN     "marketerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MarketerApplication_marketerId_key" ON "MarketerApplication"("marketerId");

-- AddForeignKey
ALTER TABLE "MarketerApplication" ADD CONSTRAINT "MarketerApplication_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "Marketer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
