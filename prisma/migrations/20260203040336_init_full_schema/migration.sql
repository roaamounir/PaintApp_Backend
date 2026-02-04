/*
  Warnings:

  - You are about to drop the column `colorCode` on the `paint` table. All the data in the column will be lost.
  - You are about to drop the column `isDiscounted` on the `paint` table. All the data in the column will be lost.
  - You are about to drop the `_offertopaint` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `base` to the `Paint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `coatHours` to the `Paint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `coverage` to the `Paint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dryDays` to the `Paint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `finish` to the `Paint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stock` to the `Paint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Paint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unit` to the `Paint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Paint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usage` to the `Paint` table without a default value. This is not possible if the table is not empty.
  - Made the column `vendorId` on table `paint` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `_offertopaint` DROP FOREIGN KEY `_OfferToPaint_A_fkey`;

-- DropForeignKey
ALTER TABLE `_offertopaint` DROP FOREIGN KEY `_OfferToPaint_B_fkey`;

-- DropForeignKey
ALTER TABLE `paint` DROP FOREIGN KEY `Paint_vendorId_fkey`;

-- AlterTable
ALTER TABLE `paint` DROP COLUMN `colorCode`,
    DROP COLUMN `isDiscounted`,
    ADD COLUMN `base` ENUM('water', 'oil', 'wood') NOT NULL,
    ADD COLUMN `coatHours` INTEGER NOT NULL,
    ADD COLUMN `coverage` DOUBLE NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `dryDays` INTEGER NOT NULL,
    ADD COLUMN `finish` ENUM('matte', 'semi_gloss', 'gloss') NOT NULL,
    ADD COLUMN `image` VARCHAR(191) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `offerId` INTEGER NULL,
    ADD COLUMN `stock` INTEGER NOT NULL,
    ADD COLUMN `type` VARCHAR(191) NOT NULL,
    ADD COLUMN `unit` ENUM('liter', 'kg') NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `usage` ENUM('indoor', 'outdoor', 'both') NOT NULL,
    MODIFY `vendorId` INTEGER NOT NULL;

-- DropTable
DROP TABLE `_offertopaint`;

-- AddForeignKey
ALTER TABLE `Paint` ADD CONSTRAINT `Paint_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Paint` ADD CONSTRAINT `Paint_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `Offer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
