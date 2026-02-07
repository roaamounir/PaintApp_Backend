/*
  Warnings:

  - You are about to drop the column `paintId` on the `cart` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `cart` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `category` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `favoritecolor` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `offer` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `offer` table. All the data in the column will be lost.
  - You are about to drop the column `area` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `serviceDate` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `serviceTime` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `zone` on the `order` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `order` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(7))`.
  - You are about to drop the column `createdAt` on the `paint` table. All the data in the column will be lost.
  - You are about to drop the column `inStock` on the `paint` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `paint` table. All the data in the column will be lost.
  - You are about to drop the column `offerId` on the `paint` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `paint` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `paint` table. All the data in the column will be lost.
  - You are about to drop the column `serviceType` on the `painter` table. All the data in the column will be lost.
  - You are about to drop the `attribute` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chatmessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `designerprofile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `favoriteproduct` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `otp` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `paintattribute` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `selection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usercategory` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Cart` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `service` to the `Painter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyType` to the `Vendor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `taxRegistration` to the `Vendor` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `Cart_paintId_fkey` ON `cart`;

-- DropIndex
DROP INDEX `Cart_userId_fkey` ON `cart`;

-- DropIndex
DROP INDEX `FavoriteColor_userId_fkey` ON `favoritecolor`;

-- DropIndex
DROP INDEX `Order_painterId_fkey` ON `order`;

-- DropIndex
DROP INDEX `Order_userId_fkey` ON `order`;

-- DropIndex
DROP INDEX `OrderItem_orderId_fkey` ON `orderitem`;

-- DropIndex
DROP INDEX `OrderItem_paintId_fkey` ON `orderitem`;

-- DropIndex
DROP INDEX `Paint_categoryId_fkey` ON `paint`;

-- DropIndex
DROP INDEX `Paint_offerId_fkey` ON `paint`;

-- DropIndex
DROP INDEX `Paint_subCategoryId_fkey` ON `paint`;

-- DropIndex
DROP INDEX `Paint_vendorId_fkey` ON `paint`;

-- DropIndex
DROP INDEX `PainterGallery_painterId_fkey` ON `paintergallery`;

-- DropIndex
DROP INDEX `PainterReview_painterId_fkey` ON `painterreview`;

-- DropIndex
DROP INDEX `PainterReview_userId_fkey` ON `painterreview`;

-- DropIndex
DROP INDEX `SubCategory_categoryId_fkey` ON `subcategory`;

-- AlterTable
ALTER TABLE `cart` DROP COLUMN `paintId`,
    DROP COLUMN `quantity`;

-- AlterTable
ALTER TABLE `category` DROP COLUMN `description`;

-- AlterTable
ALTER TABLE `favoritecolor` DROP COLUMN `name`;

-- AlterTable
ALTER TABLE `offer` DROP COLUMN `endDate`,
    DROP COLUMN `startDate`;

-- AlterTable
ALTER TABLE `order` DROP COLUMN `area`,
    DROP COLUMN `serviceDate`,
    DROP COLUMN `serviceTime`,
    DROP COLUMN `zone`,
    MODIFY `status` ENUM('pending', 'accepted', 'rejected', 'completed') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `orderitem` ALTER COLUMN `quantity` DROP DEFAULT;

-- AlterTable
ALTER TABLE `paint` DROP COLUMN `createdAt`,
    DROP COLUMN `inStock`,
    DROP COLUMN `isActive`,
    DROP COLUMN `offerId`,
    DROP COLUMN `type`,
    DROP COLUMN `updatedAt`;

-- AlterTable
ALTER TABLE `painter` DROP COLUMN `serviceType`,
    ADD COLUMN `service` ENUM('indoor', 'outdoor', 'both') NOT NULL;

-- AlterTable
ALTER TABLE `vendor` ADD COLUMN `companyType` VARCHAR(191) NOT NULL,
    ADD COLUMN `isApproved` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `taxRegistration` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `attribute`;

-- DropTable
DROP TABLE `chatmessage`;

-- DropTable
DROP TABLE `designerprofile`;

-- DropTable
DROP TABLE `favoriteproduct`;

-- DropTable
DROP TABLE `otp`;

-- DropTable
DROP TABLE `paintattribute`;

-- DropTable
DROP TABLE `selection`;

-- DropTable
DROP TABLE `usercategory`;

-- CreateTable
CREATE TABLE `Onboarding` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PainterVisit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `painterId` INTEGER NOT NULL,
    `visitDate` DATETIME(3) NOT NULL,
    `area` DOUBLE NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'accepted', 'rejected', 'completed') NOT NULL DEFAULT 'pending',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CartItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cartId` INTEGER NOT NULL,
    `paintId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Cart_userId_key` ON `Cart`(`userId`);

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Painter` ADD CONSTRAINT `Painter_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PainterVisit` ADD CONSTRAINT `PainterVisit_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PainterVisit` ADD CONSTRAINT `PainterVisit_painterId_fkey` FOREIGN KEY (`painterId`) REFERENCES `Painter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubCategory` ADD CONSTRAINT `SubCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Paint` ADD CONSTRAINT `Paint_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Paint` ADD CONSTRAINT `Paint_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Paint` ADD CONSTRAINT `Paint_subCategoryId_fkey` FOREIGN KEY (`subCategoryId`) REFERENCES `SubCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cart` ADD CONSTRAINT `Cart_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_paintId_fkey` FOREIGN KEY (`paintId`) REFERENCES `Paint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_paintId_fkey` FOREIGN KEY (`paintId`) REFERENCES `Paint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FavoriteColor` ADD CONSTRAINT `FavoriteColor_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PainterGallery` ADD CONSTRAINT `PainterGallery_painterId_fkey` FOREIGN KEY (`painterId`) REFERENCES `Painter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PainterReview` ADD CONSTRAINT `PainterReview_painterId_fkey` FOREIGN KEY (`painterId`) REFERENCES `Painter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PainterReview` ADD CONSTRAINT `PainterReview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
