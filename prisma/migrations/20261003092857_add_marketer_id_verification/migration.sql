-- CreateEnum
CREATE TYPE "MarketerIdVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVIEW');

-- DropIndex
DROP INDEX "CustomerEmailVerification_expiresAt_idx";

-- AlterTable
ALTER TABLE "MarketerApplication" ADD COLUMN     "idVerificationDecision" TEXT,
ADD COLUMN     "idVerificationMessage" TEXT,
ADD COLUMN     "idVerificationStatus" "MarketerIdVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "idVerificationTransactionId" TEXT,
ADD COLUMN     "idVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MarketerApplication_idVerificationStatus_idx" ON "MarketerApplication"("idVerificationStatus");
