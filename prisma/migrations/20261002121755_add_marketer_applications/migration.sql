-- CreateEnum
CREATE TYPE "MarketerIdType" AS ENUM ('NATIONAL_ID', 'PASSPORT');

-- CreateEnum
CREATE TYPE "MarketerApplicationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MarketerApplication" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "idType" "MarketerIdType" NOT NULL,
    "idNumber" TEXT NOT NULL,
    "idFrontUrl" TEXT,
    "idBackUrl" TEXT,
    "county" TEXT NOT NULL,
    "places" TEXT[],
    "timeInSelectedAreas" TEXT NOT NULL,
    "hasRealEstateExperience" BOOLEAN NOT NULL,
    "experienceAreas" TEXT[],
    "experienceDuration" TEXT NOT NULL,
    "experienceDescription" TEXT NOT NULL,
    "currentOccupation" TEXT NOT NULL,
    "workingWithAnotherAgency" BOOLEAN NOT NULL,
    "currentAgencyName" TEXT,
    "motivation" TEXT NOT NULL,
    "contribution" TEXT NOT NULL,
    "expectedPropertiesPerMonth" TEXT NOT NULL,
    "propertySources" TEXT[],
    "knowsLandlords" BOOLEAN NOT NULL,
    "approximateLandlordCount" INTEGER,
    "comfortableCommunicating" BOOLEAN NOT NULL,
    "communicationMethods" TEXT[],
    "timeAvailability" TEXT NOT NULL,
    "willingToFollowProcedures" BOOLEAN NOT NULL,
    "referenceName" TEXT NOT NULL,
    "referencePhone" TEXT NOT NULL,
    "referenceRelationship" TEXT NOT NULL,
    "declarationAccepted" BOOLEAN NOT NULL,
    "status" "MarketerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "rejectionReason" TEXT,
    "requestedChanges" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketerApplication_status_idx" ON "MarketerApplication"("status");

-- CreateIndex
CREATE INDEX "MarketerApplication_email_idx" ON "MarketerApplication"("email");

-- CreateIndex
CREATE INDEX "MarketerApplication_phone_idx" ON "MarketerApplication"("phone");

-- CreateIndex
CREATE INDEX "MarketerApplication_county_idx" ON "MarketerApplication"("county");

-- CreateIndex
CREATE INDEX "MarketerApplication_createdAt_idx" ON "MarketerApplication"("createdAt");
