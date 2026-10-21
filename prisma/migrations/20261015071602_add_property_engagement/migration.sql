-- AlterTable
ALTER TABLE "MarketerApplication" ALTER COLUMN "placeIds" SET DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PropertyLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyComment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "viewType" TEXT NOT NULL,
    "viewDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyLike_propertyId_idx" ON "PropertyLike"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyLike_userId_idx" ON "PropertyLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyLike_userId_propertyId_key" ON "PropertyLike"("userId", "propertyId");

-- CreateIndex
CREATE INDEX "PropertyComment_propertyId_createdAt_idx" ON "PropertyComment"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyComment_userId_idx" ON "PropertyComment"("userId");

-- CreateIndex
CREATE INDEX "PropertyView_propertyId_viewType_idx" ON "PropertyView"("propertyId", "viewType");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyView_userId_propertyId_viewType_viewDate_key" ON "PropertyView"("userId", "propertyId", "viewType", "viewDate");

-- AddForeignKey
ALTER TABLE "PropertyLike" ADD CONSTRAINT "PropertyLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyLike" ADD CONSTRAINT "PropertyLike_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyComment" ADD CONSTRAINT "PropertyComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyComment" ADD CONSTRAINT "PropertyComment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyView" ADD CONSTRAINT "PropertyView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyView" ADD CONSTRAINT "PropertyView_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
