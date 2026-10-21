/*
  Warnings:

  - Made the column `sourceId` on table `Constituency` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sourceId` on table `County` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sourceId` on table `Ward` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Constituency" ALTER COLUMN "sourceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "County" ALTER COLUMN "sourceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Ward" ALTER COLUMN "sourceId" SET NOT NULL;
