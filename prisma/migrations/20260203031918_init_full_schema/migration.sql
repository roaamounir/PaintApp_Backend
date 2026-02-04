/*
  Warnings:

  - You are about to drop the column `name` on the `painter` table. All the data in the column will be lost.
  - You are about to drop the column `profilePic` on the `painter` table. All the data in the column will be lost.
  - You are about to alter the column `role` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(0))`.
  - A unique constraint covering the columns `[userId]` on the table `Painter` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Painter` table without a default value. This is not possible if the table is not empty.
  - Made the column `rating` on table `painter` required. This step will fail if there are existing NULL values in that column.
  - Made the column `experience` on table `painter` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `paint` ADD COLUMN `isDiscounted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `subCategoryId` INTEGER NULL,
    ADD COLUMN `vendorId` INTEGER NULL,
    MODIFY `colorCode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `painter` DROP COLUMN `name`,
    DROP COLUMN `profilePic`,
    ADD COLUMN `userId` INTEGER NOT NULL,
    MODIFY `rating` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `experience` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `role` ENUM('user', 'admin', 'painter', 'vendor') NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE `Vendor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `shopName` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,

    UNIQUE INDEX `Vendor_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attribute` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaintAttribute` (
    `paintId` INTEGER NOT NULL,
    `attributeId` INTEGER NOT NULL,

    PRIMARY KEY (`paintId`, `attributeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Offer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `discount` DOUBLE NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FavoriteProduct` (
    `userId` INTEGER NOT NULL,
    `paintId` INTEGER NOT NULL,

    PRIMARY KEY (`userId`, `paintId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_OfferToPaint` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_OfferToPaint_AB_unique`(`A`, `B`),
    INDEX `_OfferToPaint_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Painter_userId_key` ON `Painter`(`userId`);

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubCategory` ADD CONSTRAINT `SubCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Paint` ADD CONSTRAINT `Paint_subCategoryId_fkey` FOREIGN KEY (`subCategoryId`) REFERENCES `SubCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Paint` ADD CONSTRAINT `Paint_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaintAttribute` ADD CONSTRAINT `PaintAttribute_paintId_fkey` FOREIGN KEY (`paintId`) REFERENCES `Paint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaintAttribute` ADD CONSTRAINT `PaintAttribute_attributeId_fkey` FOREIGN KEY (`attributeId`) REFERENCES `Attribute`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FavoriteProduct` ADD CONSTRAINT `FavoriteProduct_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FavoriteProduct` ADD CONSTRAINT `FavoriteProduct_paintId_fkey` FOREIGN KEY (`paintId`) REFERENCES `Paint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Painter` ADD CONSTRAINT `Painter_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_OfferToPaint` ADD CONSTRAINT `_OfferToPaint_A_fkey` FOREIGN KEY (`A`) REFERENCES `Offer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_OfferToPaint` ADD CONSTRAINT `_OfferToPaint_B_fkey` FOREIGN KEY (`B`) REFERENCES `Paint`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
