/*
  Warnings:

  - You are about to drop the column `compatKeys` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `specDefs` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `active_status` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `compatibility` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `completeness` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `datasheet_url` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `ean` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `needs_review` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `release_date` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `review_status` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `warranty_years` on the `Component` table. All the data in the column will be lost.
  - You are about to drop the column `confidence` on the `ExternalId` table. All the data in the column will be lost.
  - You are about to drop the column `externalId` on the `ExternalId` table. All the data in the column will be lost.
  - You are about to drop the column `failCount` on the `ExternalId` table. All the data in the column will be lost.
  - You are about to drop the column `matchMethod` on the `ExternalId` table. All the data in the column will be lost.
  - You are about to drop the column `last_updated` on the `Offer` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Offer` table. All the data in the column will be lost.
  - You are about to drop the column `vendorId` on the `Offer` table. All the data in the column will be lost.
  - You are about to drop the column `vendor_url` on the `Offer` table. All the data in the column will be lost.
  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CompatibilityRule` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `type` to the `Component` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ExternalId` table without a default value. This is not possible if the table is not empty.
  - Made the column `externalUrl` on table `ExternalId` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Offer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Offer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vendor` to the `Offer` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_componentId_fkey";

-- DropForeignKey
ALTER TABLE "Component" DROP CONSTRAINT "Component_categoryId_fkey";

-- DropIndex
DROP INDEX "Offer_componentId_idx";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "compatKeys",
DROP COLUMN "specDefs",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "specKeys" JSONB;

-- AlterTable
ALTER TABLE "Component" DROP COLUMN "active_status",
DROP COLUMN "categoryId",
DROP COLUMN "compatibility",
DROP COLUMN "completeness",
DROP COLUMN "datasheet_url",
DROP COLUMN "ean",
DROP COLUMN "images",
DROP COLUMN "needs_review",
DROP COLUMN "release_date",
DROP COLUMN "review_status",
DROP COLUMN "warranty_years",
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "price_current" INTEGER,
ADD COLUMN     "type" TEXT NOT NULL,
ALTER COLUMN "specs" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ExternalId" DROP COLUMN "confidence",
DROP COLUMN "externalId",
DROP COLUMN "failCount",
DROP COLUMN "matchMethod",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "sourceId" DROP NOT NULL,
ALTER COLUMN "externalUrl" SET NOT NULL;

-- AlterTable
ALTER TABLE "Offer" DROP COLUMN "last_updated",
DROP COLUMN "quantity",
DROP COLUMN "vendorId",
DROP COLUMN "vendor_url",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "url" TEXT NOT NULL,
ADD COLUMN     "vendor" TEXT NOT NULL,
ALTER COLUMN "sourceId" DROP NOT NULL,
ALTER COLUMN "effective_price" DROP NOT NULL,
ALTER COLUMN "in_stock" SET DEFAULT true;

-- DropTable
DROP TABLE "AuditLog";

-- DropTable
DROP TABLE "CompatibilityRule";

-- CreateTable
CREATE TABLE "Cpu" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "socket" TEXT NOT NULL,
    "cores" INTEGER NOT NULL,
    "threads" INTEGER NOT NULL,
    "base_clock" DOUBLE PRECISION NOT NULL,
    "boost_clock" DOUBLE PRECISION NOT NULL,
    "tdp_watts" INTEGER NOT NULL,
    "integrated_gpu" BOOLEAN NOT NULL DEFAULT false,
    "includes_cooler" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Cpu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Motherboard" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "socket" TEXT NOT NULL,
    "form_factor" TEXT NOT NULL,
    "memory_type" TEXT NOT NULL,
    "memory_slots" INTEGER NOT NULL,
    "max_memory_gb" INTEGER NOT NULL,
    "m2_slots" INTEGER NOT NULL,
    "wifi" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Motherboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gpu" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "chipset" TEXT NOT NULL,
    "vram_gb" INTEGER NOT NULL,
    "length_mm" INTEGER NOT NULL,
    "tdp_watts" INTEGER NOT NULL,
    "recommended_psu" INTEGER NOT NULL,

    CONSTRAINT "Gpu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ram" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "memory_type" TEXT NOT NULL,
    "capacity_gb" INTEGER NOT NULL,
    "modules" INTEGER NOT NULL,
    "speed_mhz" INTEGER NOT NULL,
    "cas_latency" INTEGER,

    CONSTRAINT "Ram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Storage" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity_gb" INTEGER NOT NULL,
    "gen" TEXT,

    CONSTRAINT "Storage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Psu" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "wattage" INTEGER NOT NULL,
    "efficiency" TEXT,
    "modular" TEXT,

    CONSTRAINT "Psu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cabinet" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "supported_forms" TEXT[],
    "max_gpu_len_mm" INTEGER NOT NULL,
    "max_cpu_height" INTEGER NOT NULL,

    CONSTRAINT "Cabinet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cooler" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sockets" TEXT[],
    "height_mm" INTEGER,
    "radiator_size" INTEGER,

    CONSTRAINT "Cooler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cpu_componentId_key" ON "Cpu"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Motherboard_componentId_key" ON "Motherboard"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Gpu_componentId_key" ON "Gpu"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Ram_componentId_key" ON "Ram"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Storage_componentId_key" ON "Storage"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Psu_componentId_key" ON "Psu"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Cabinet_componentId_key" ON "Cabinet"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Cooler_componentId_key" ON "Cooler"("componentId");

-- AddForeignKey
ALTER TABLE "Cpu" ADD CONSTRAINT "Cpu_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motherboard" ADD CONSTRAINT "Motherboard_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gpu" ADD CONSTRAINT "Gpu_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ram" ADD CONSTRAINT "Ram_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storage" ADD CONSTRAINT "Storage_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Psu" ADD CONSTRAINT "Psu_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cabinet" ADD CONSTRAINT "Cabinet_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cooler" ADD CONSTRAINT "Cooler_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;
