/*
  Warnings:

  - You are about to drop the column `placeIds` on the `MarketerApplication` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LandlordApplicationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LandlordIdVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVIEW', 'REJECTED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'LANDLORD';

-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_marketerId_fkey";

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "landlordId" TEXT,
ALTER COLUMN "marketerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Landlord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nationalIdNumber" TEXT NOT NULL,
    "idFrontReference" TEXT,
    "idBackReference" TEXT,
    "idVerificationStatus" "LandlordIdVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "idVerificationMessage" TEXT,
    "questionnaire" JSONB NOT NULL,
    "applicationStatus" "LandlordApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Landlord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Landlord_userId_key" ON "Landlord"("userId");

-- CreateIndex
CREATE INDEX "Landlord_applicationStatus_idx" ON "Landlord"("applicationStatus");

-- CreateIndex
CREATE INDEX "Landlord_idVerificationStatus_idx" ON "Landlord"("idVerificationStatus");

-- CreateIndex
CREATE INDEX "Landlord_createdAt_idx" ON "Landlord"("createdAt");

-- CreateIndex
CREATE INDEX "Property_landlordId_idx" ON "Property"("landlordId");

-- AddForeignKey
ALTER TABLE "Landlord" ADD CONSTRAINT "Landlord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "Marketer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "Landlord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
