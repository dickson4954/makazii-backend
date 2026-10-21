/*
  Warnings:

  - You are about to drop the column `email` on the `MarketerProfileChangeRequest` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `MarketerProfileChangeRequest` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `MarketerProfileChangeRequest` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `MarketerProfileChangeRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MarketerProfileChangeRequest" DROP COLUMN "email",
DROP COLUMN "firstName",
DROP COLUMN "lastName",
DROP COLUMN "phone",
ADD COLUMN     "currentEmail" TEXT,
ADD COLUMN     "currentFirstName" TEXT,
ADD COLUMN     "currentLastName" TEXT,
ADD COLUMN     "currentPhone" TEXT,
ADD COLUMN     "requestedEmail" TEXT,
ADD COLUMN     "requestedFirstName" TEXT,
ADD COLUMN     "requestedLastName" TEXT,
ADD COLUMN     "requestedPhone" TEXT;
