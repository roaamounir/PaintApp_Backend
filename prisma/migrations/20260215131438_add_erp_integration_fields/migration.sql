/*
  Warnings:

  - You are about to drop the column `paymentType` on the `order` table. All the data in the column will be lost.
  - You are about to alter the column `source` on the `order` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(9))`.
  - A unique constraint covering the columns `[externalId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[barcode]` on the table `Paint` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `order` DROP COLUMN `paymentType`,
    ADD COLUMN `externalId` VARCHAR(191) NULL,
    ADD COLUMN `type` ENUM('retail', 'wholesale', 'project') NOT NULL DEFAULT 'retail',
    MODIFY `source` ENUM('app', 'pos', 'phone') NOT NULL DEFAULT 'app';

-- AlterTable
ALTER TABLE `paint` ADD COLUMN `availability` VARCHAR(191) NOT NULL DEFAULT 'in_stock',
    ADD COLUMN `barcode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `customerType` ENUM('cash', 'credit', 'vip') NOT NULL DEFAULT 'cash';

-- CreateIndex
CREATE UNIQUE INDEX `Order_externalId_key` ON `Order`(`externalId`);

-- CreateIndex
CREATE UNIQUE INDEX `Paint_barcode_key` ON `Paint`(`barcode`);
