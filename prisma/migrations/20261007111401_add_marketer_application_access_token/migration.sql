/*
  Warnings:

  - A unique constraint covering the columns `[accessTokenHash]` on the table `MarketerApplication` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MarketerApplication" ADD COLUMN     "accessTokenCreatedAt" TIMESTAMP(3),
ADD COLUMN     "accessTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MarketerApplication_accessTokenHash_key" ON "MarketerApplication"("accessTokenHash");
