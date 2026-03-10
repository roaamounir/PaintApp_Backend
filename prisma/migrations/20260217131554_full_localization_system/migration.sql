/*
  Warnings:

  - You are about to drop the column `externalId` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `externalRef` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `isPaid` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentType` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `processedById` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `vendorCommission` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `vendorNetProfit` on the `order` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name_ar]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name_en]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name_ar]` on the table `ColorSystem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name_en]` on the table `ColorSystem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `price` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `Order_externalId_key` ON `order`;

-- DropIndex
DROP INDEX `Order_externalRef_key` ON `order`;

-- AlterTable
ALTER TABLE `category` ADD COLUMN `name_ar` VARCHAR(191) NULL,
    ADD COLUMN `name_en` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `colorsystem` ADD COLUMN `name_ar` VARCHAR(191) NULL,
    ADD COLUMN `name_en` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `offer` ADD COLUMN `title_ar` VARCHAR(191) NULL,
    ADD COLUMN `title_en` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `onboarding` ADD COLUMN `description_ar` VARCHAR(191) NULL,
    ADD COLUMN `description_en` VARCHAR(191) NULL,
    ADD COLUMN `title_ar` VARCHAR(191) NULL,
    ADD COLUMN `title_en` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `order` DROP COLUMN `externalId`,
    DROP COLUMN `externalRef`,
    DROP COLUMN `isPaid`,
    DROP COLUMN `paymentType`,
    DROP COLUMN `processedById`,
    DROP COLUMN `type`,
    DROP COLUMN `vendorCommission`,
    DROP COLUMN `vendorNetProfit`;

-- AlterTable
ALTER TABLE `orderitem` ADD COLUMN `price` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `paint` ADD COLUMN `description_ar` TEXT NULL,
    ADD COLUMN `description_en` TEXT NULL,
    ADD COLUMN `name_ar` VARCHAR(191) NULL,
    ADD COLUMN `name_en` VARCHAR(191) NULL,
    MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `painter` ADD COLUMN `address_ar` VARCHAR(191) NULL,
    ADD COLUMN `address_en` VARCHAR(191) NULL,
    ADD COLUMN `bio_ar` TEXT NULL,
    ADD COLUMN `bio_en` TEXT NULL,
    ADD COLUMN `city_ar` VARCHAR(191) NULL,
    ADD COLUMN `city_en` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `painterdocument` ADD COLUMN `type_ar` VARCHAR(191) NULL,
    ADD COLUMN `type_en` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `paintervisit` ADD COLUMN `city_ar` VARCHAR(191) NULL,
    ADD COLUMN `city_en` VARCHAR(191) NULL,
    ADD COLUMN `region_ar` VARCHAR(191) NULL,
    ADD COLUMN `region_en` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `subcategory` ADD COLUMN `name_ar` VARCHAR(191) NULL,
    ADD COLUMN `name_en` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `vendor` ADD COLUMN `address_ar` VARCHAR(191) NULL,
    ADD COLUMN `address_en` VARCHAR(191) NULL,
    ADD COLUMN `city_ar` VARCHAR(191) NULL,
    ADD COLUMN `city_en` VARCHAR(191) NULL,
    ADD COLUMN `companyType_ar` VARCHAR(191) NULL,
    ADD COLUMN `companyType_en` VARCHAR(191) NULL,
    ADD COLUMN `region_ar` VARCHAR(191) NULL,
    ADD COLUMN `region_en` VARCHAR(191) NULL,
    ADD COLUMN `shopName_ar` VARCHAR(191) NULL,
    ADD COLUMN `shopName_en` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `wallettransaction` ADD COLUMN `description_ar` VARCHAR(191) NULL,
    ADD COLUMN `description_en` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Category_name_ar_key` ON `Category`(`name_ar`);

-- CreateIndex
CREATE UNIQUE INDEX `Category_name_en_key` ON `Category`(`name_en`);

-- CreateIndex
CREATE UNIQUE INDEX `ColorSystem_name_ar_key` ON `ColorSystem`(`name_ar`);

-- CreateIndex
CREATE UNIQUE INDEX `ColorSystem_name_en_key` ON `ColorSystem`(`name_en`);
