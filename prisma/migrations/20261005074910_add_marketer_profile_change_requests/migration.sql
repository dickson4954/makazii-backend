-- CreateEnum
CREATE TYPE "MarketerProfileChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MarketerProfileChangeRequest" (
    "id" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "reason" TEXT,
    "status" "MarketerProfileChangeStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketerProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketerProfileChangeRequest_marketerId_idx" ON "MarketerProfileChangeRequest"("marketerId");

-- CreateIndex
CREATE INDEX "MarketerProfileChangeRequest_status_idx" ON "MarketerProfileChangeRequest"("status");

-- CreateIndex
CREATE INDEX "MarketerProfileChangeRequest_createdAt_idx" ON "MarketerProfileChangeRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "MarketerProfileChangeRequest" ADD CONSTRAINT "MarketerProfileChangeRequest_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "Marketer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
