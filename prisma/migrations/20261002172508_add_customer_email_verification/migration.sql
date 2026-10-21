-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CustomerEmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerEmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerEmailVerification_userId_idx" ON "CustomerEmailVerification"("userId");

-- CreateIndex
CREATE INDEX "CustomerEmailVerification_expiresAt_idx" ON "CustomerEmailVerification"("expiresAt");

-- AddForeignKey
ALTER TABLE "CustomerEmailVerification" ADD CONSTRAINT "CustomerEmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
