-- CreateTable
CREATE TABLE "Constituency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Constituency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "constituencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Constituency_countyId_idx" ON "Constituency"("countyId");

-- CreateIndex
CREATE INDEX "Constituency_name_idx" ON "Constituency"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Constituency_countyId_name_key" ON "Constituency"("countyId", "name");

-- CreateIndex
CREATE INDEX "Ward_constituencyId_idx" ON "Ward"("constituencyId");

-- CreateIndex
CREATE INDEX "Ward_name_idx" ON "Ward"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_constituencyId_name_key" ON "Ward"("constituencyId", "name");

-- AddForeignKey
ALTER TABLE "Constituency" ADD CONSTRAINT "Constituency_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "County"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
