/*
  Warnings:

  - The values [LANDLORD] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - The values [REQUESTED] on the enum `ViewingStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `landlordId` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `propertyType` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `rent` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `PropertyStatusHistory` table. All the data in the column will be lost.
  - You are about to drop the `Landlord` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Amenity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `purpose` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Made the column `marketerId` on table `Property` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `uploadedById` to the `PropertyImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toStatus` to the `PropertyStatusHistory` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PropertyPurpose" AS ENUM ('LONG_STAY', 'SHORT_STAY');

-- CreateEnum
CREATE TYPE "LongStayType" AS ENUM ('SINGLE_ROOM', 'BEDSITTER', 'STUDIO', 'ONE_BEDROOM', 'TWO_BEDROOM', 'THREE_BEDROOM', 'FOUR_PLUS_BEDROOM', 'HOUSE', 'APARTMENT');

-- CreateEnum
CREATE TYPE "ShortStayType" AS ENUM ('BNB', 'LODGE', 'GUEST_HOUSE', 'HOTEL_ROOM', 'SERVICED_APARTMENT', 'FURNISHED_APARTMENT', 'HOLIDAY_HOME', 'VILLA', 'COTTAGE', 'HOSTEL', 'PRIVATE_ROOM');

-- CreateEnum
CREATE TYPE "StayMode" AS ENUM ('DAY', 'OVERNIGHT', 'DAY_AND_NIGHT', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "FurnishingType" AS ENUM ('UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED');

-- CreateEnum
CREATE TYPE "ImageCategory" AS ENUM ('EXTERIOR', 'BEDROOM', 'BATHROOM', 'KITCHEN', 'LIVING_ROOM', 'VIEW', 'AMENITY', 'OTHER');

-- CreateEnum
CREATE TYPE "AmenityCategory" AS ENUM ('CONNECTIVITY', 'SECURITY', 'BATHROOM', 'KITCHEN', 'PARKING', 'OUTDOOR', 'ENTERTAINMENT', 'ACCESSIBILITY', 'FAMILY', 'OTHER');

-- CreateEnum
CREATE TYPE "StayInspectionStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'AWAITING_ASSIGNMENT', 'ASSIGNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'DECLINED');

-- CreateEnum
CREATE TYPE "StayBookingStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'AWAITING_ASSIGNMENT', 'ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'STAYING', 'CHECKED_OUT', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MPESA', 'CARD', 'BANK', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MPESA', 'STRIPE', 'BANK', 'INTERNAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('VIEWING_REQUESTED', 'VIEWING_PAID', 'VIEWING_ASSIGNED', 'VIEWING_CONFIRMED', 'VIEWING_COMPLETED', 'INSPECTION_REQUESTED', 'INSPECTION_PAID', 'INSPECTION_ASSIGNED', 'INSPECTION_CONFIRMED', 'INSPECTION_COMPLETED', 'BOOKING_REQUESTED', 'BOOKING_PAID', 'BOOKING_ASSIGNED', 'BOOKING_CONFIRMED', 'BOOKING_CHECKED_IN', 'BOOKING_CHECKED_OUT', 'BOOKING_COMPLETED', 'PROPERTY_APPROVED', 'PROPERTY_CHANGES_REQUIRED', 'PROPERTY_REJECTED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'GENERAL');

-- CreateEnum
CREATE TYPE "SupportRequestType" AS ENUM ('FEEDBACK', 'PROBLEM_REPORT', 'HELP', 'CONTACT');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('APP_EXPERIENCE', 'PROPERTY', 'VIEWING', 'STAY', 'MARKETER', 'PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProblemReportCategory" AS ENUM ('PROPERTY', 'VIEWING', 'STAY', 'MARKETER', 'PAYMENT', 'ACCOUNT', 'APP', 'OTHER');

-- CreateEnum
CREATE TYPE "ProblemReportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'STAFF', 'MARKETER', 'RENTER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'RENTER';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ViewingStatus_new" AS ENUM ('PENDING_PAYMENT', 'PAID', 'AWAITING_ASSIGNMENT', 'ASSIGNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'DECLINED');
ALTER TABLE "public"."ViewingRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ViewingRequest" ALTER COLUMN "status" TYPE "ViewingStatus_new" USING ("status"::text::"ViewingStatus_new");
ALTER TABLE "ViewingStatusHistory" ALTER COLUMN "status" TYPE "ViewingStatus_new" USING ("status"::text::"ViewingStatus_new");
ALTER TYPE "ViewingStatus" RENAME TO "ViewingStatus_old";
ALTER TYPE "ViewingStatus_new" RENAME TO "ViewingStatus";
DROP TYPE "public"."ViewingStatus_old";
ALTER TABLE "ViewingRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
COMMIT;

-- DropForeignKey
ALTER TABLE "Landlord" DROP CONSTRAINT "Landlord_userId_fkey";

-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_landlordId_fkey";

-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_marketerId_fkey";

-- DropIndex
DROP INDEX "Property_landlordId_idx";

-- DropIndex
DROP INDEX "Property_propertyType_idx";

-- DropIndex
DROP INDEX "Property_rent_idx";

-- DropIndex
DROP INDEX "Property_viewingFee_idx";

-- AlterTable
ALTER TABLE "Amenity" ADD COLUMN     "category" "AmenityCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Amenity" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "landlordId",
DROP COLUMN "propertyType",
DROP COLUMN "rent",
ADD COLUMN     "beds" INTEGER,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "dayNightRate" INTEGER,
ADD COLUMN     "dayRate" INTEGER,
ADD COLUMN     "furnishing" "FurnishingType",
ADD COLUMN     "longStayType" "LongStayType",
ADD COLUMN     "maxGuests" INTEGER,
ADD COLUMN     "monthlyRent" INTEGER,
ADD COLUMN     "nightRate" INTEGER,
ADD COLUMN     "purpose" "PropertyPurpose" NOT NULL,
ADD COLUMN     "serviceCharge" INTEGER,
ADD COLUMN     "shortStayType" "ShortStayType",
ADD COLUMN     "stayMode" "StayMode",
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT,
ALTER COLUMN "marketerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PropertyImage" ADD COLUMN     "category" "ImageCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "uploadedById" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PropertyStatusHistory" DROP COLUMN "status",
ADD COLUMN     "fromStatus" "PropertyStatus",
ADD COLUMN     "toStatus" "PropertyStatus" NOT NULL;

-- AlterTable
ALTER TABLE "ViewingRequest" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE "ViewingStatusHistory" ADD COLUMN     "changedById" TEXT;

-- DropTable
DROP TABLE "Landlord";

-- DropEnum
DROP TYPE "PropertyType";

-- CreateTable
CREATE TABLE "StayInspection" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "renterId" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3),
    "preferredTime" TEXT,
    "notes" TEXT,
    "status" "StayInspectionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "assignedMarketerId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StayInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StayBooking" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "renterId" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3),
    "startTime" TEXT,
    "endTime" TEXT,
    "guests" INTEGER NOT NULL,
    "stayMode" "StayMode" NOT NULL,
    "status" "StayBookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "dayRateSnapshot" INTEGER,
    "nightRateSnapshot" INTEGER,
    "dayNightRateSnapshot" INTEGER,
    "totalAmount" INTEGER,
    "assignedMarketerId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StayBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewingRequestId" TEXT,
    "stayInspectionId" TEXT,
    "stayBookingId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "method" "PaymentMethod",
    "provider" "PaymentProvider",
    "reference" TEXT,
    "providerReference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SupportRequestType" NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "propertyId" TEXT,
    "viewingId" TEXT,
    "stayBookingId" TEXT,
    "marketerId" TEXT,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "adminResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "rating" INTEGER,
    "message" TEXT NOT NULL,
    "propertyId" TEXT,
    "viewingId" TEXT,
    "stayBookingId" TEXT,
    "marketerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "ProblemReportCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "propertyId" TEXT,
    "viewingId" TEXT,
    "stayBookingId" TEXT,
    "marketerId" TEXT,
    "status" "ProblemReportStatus" NOT NULL DEFAULT 'OPEN',
    "adminResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StayInspection_propertyId_idx" ON "StayInspection"("propertyId");

-- CreateIndex
CREATE INDEX "StayInspection_renterId_idx" ON "StayInspection"("renterId");

-- CreateIndex
CREATE INDEX "StayInspection_status_idx" ON "StayInspection"("status");

-- CreateIndex
CREATE INDEX "StayInspection_requestedDate_idx" ON "StayInspection"("requestedDate");

-- CreateIndex
CREATE INDEX "StayInspection_assignedMarketerId_idx" ON "StayInspection"("assignedMarketerId");

-- CreateIndex
CREATE INDEX "StayInspection_createdAt_idx" ON "StayInspection"("createdAt");

-- CreateIndex
CREATE INDEX "StayBooking_propertyId_idx" ON "StayBooking"("propertyId");

-- CreateIndex
CREATE INDEX "StayBooking_renterId_idx" ON "StayBooking"("renterId");

-- CreateIndex
CREATE INDEX "StayBooking_status_idx" ON "StayBooking"("status");

-- CreateIndex
CREATE INDEX "StayBooking_checkInDate_idx" ON "StayBooking"("checkInDate");

-- CreateIndex
CREATE INDEX "StayBooking_checkOutDate_idx" ON "StayBooking"("checkOutDate");

-- CreateIndex
CREATE INDEX "StayBooking_assignedMarketerId_idx" ON "StayBooking"("assignedMarketerId");

-- CreateIndex
CREATE INDEX "StayBooking_createdAt_idx" ON "StayBooking"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_reference_idx" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_providerReference_idx" ON "Payment"("providerReference");

-- CreateIndex
CREATE INDEX "Payment_viewingRequestId_idx" ON "Payment"("viewingRequestId");

-- CreateIndex
CREATE INDEX "Payment_stayInspectionId_idx" ON "Payment"("stayInspectionId");

-- CreateIndex
CREATE INDEX "Payment_stayBookingId_idx" ON "Payment"("stayBookingId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_userId_idx" ON "SupportRequest"("userId");

-- CreateIndex
CREATE INDEX "SupportRequest_type_idx" ON "SupportRequest"("type");

-- CreateIndex
CREATE INDEX "SupportRequest_status_idx" ON "SupportRequest"("status");

-- CreateIndex
CREATE INDEX "SupportRequest_createdAt_idx" ON "SupportRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "Feedback_category_idx" ON "Feedback"("category");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "ProblemReport_userId_idx" ON "ProblemReport"("userId");

-- CreateIndex
CREATE INDEX "ProblemReport_category_idx" ON "ProblemReport"("category");

-- CreateIndex
CREATE INDEX "ProblemReport_status_idx" ON "ProblemReport"("status");

-- CreateIndex
CREATE INDEX "ProblemReport_createdAt_idx" ON "ProblemReport"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Amenity_category_idx" ON "Amenity"("category");

-- CreateIndex
CREATE INDEX "Amenity_isActive_idx" ON "Amenity"("isActive");

-- CreateIndex
CREATE INDEX "CustomerEmailVerification_expiresAt_idx" ON "CustomerEmailVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "Marketer_createdAt_idx" ON "Marketer"("createdAt");

-- CreateIndex
CREATE INDEX "Property_purpose_idx" ON "Property"("purpose");

-- CreateIndex
CREATE INDEX "Property_longStayType_idx" ON "Property"("longStayType");

-- CreateIndex
CREATE INDEX "Property_shortStayType_idx" ON "Property"("shortStayType");

-- CreateIndex
CREATE INDEX "Property_monthlyRent_idx" ON "Property"("monthlyRent");

-- CreateIndex
CREATE INDEX "Property_dayRate_idx" ON "Property"("dayRate");

-- CreateIndex
CREATE INDEX "Property_nightRate_idx" ON "Property"("nightRate");

-- CreateIndex
CREATE INDEX "Property_createdById_idx" ON "Property"("createdById");

-- CreateIndex
CREATE INDEX "Property_verifiedById_idx" ON "Property"("verifiedById");

-- CreateIndex
CREATE INDEX "Property_marketerCoverageId_idx" ON "Property"("marketerCoverageId");

-- CreateIndex
CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");

-- CreateIndex
CREATE INDEX "PropertyImage_uploadedById_idx" ON "PropertyImage"("uploadedById");

-- CreateIndex
CREATE INDEX "PropertyImage_category_idx" ON "PropertyImage"("category");

-- CreateIndex
CREATE INDEX "PropertyStatusHistory_createdAt_idx" ON "PropertyStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "ViewingRequest_createdAt_idx" ON "ViewingRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ViewingStatusHistory_status_idx" ON "ViewingStatusHistory"("status");

-- CreateIndex
CREATE INDEX "ViewingStatusHistory_createdAt_idx" ON "ViewingStatusHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "Marketer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayInspection" ADD CONSTRAINT "StayInspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayInspection" ADD CONSTRAINT "StayInspection_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayInspection" ADD CONSTRAINT "StayInspection_assignedMarketerId_fkey" FOREIGN KEY ("assignedMarketerId") REFERENCES "Marketer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayBooking" ADD CONSTRAINT "StayBooking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayBooking" ADD CONSTRAINT "StayBooking_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayBooking" ADD CONSTRAINT "StayBooking_assignedMarketerId_fkey" FOREIGN KEY ("assignedMarketerId") REFERENCES "Marketer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_viewingRequestId_fkey" FOREIGN KEY ("viewingRequestId") REFERENCES "ViewingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_stayInspectionId_fkey" FOREIGN KEY ("stayInspectionId") REFERENCES "StayInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_stayBookingId_fkey" FOREIGN KEY ("stayBookingId") REFERENCES "StayBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemReport" ADD CONSTRAINT "ProblemReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
