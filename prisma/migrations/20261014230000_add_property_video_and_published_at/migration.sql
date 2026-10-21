-- Add optional video metadata and actual publication timestamp.
-- Existing properties remain valid; no videos or publication dates are fabricated.
ALTER TABLE "Property"
  ADD COLUMN "videoUrl" TEXT,
  ADD COLUMN "videoPublicId" TEXT,
  ADD COLUMN "videoMimeType" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3);

CREATE INDEX "Property_publishedAt_idx"
  ON "Property"("publishedAt");
