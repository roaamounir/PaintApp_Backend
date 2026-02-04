/*
  Warnings:

  - Added the required column `city` to the `Painter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceType` to the `Painter` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `order` ADD COLUMN `area` DOUBLE NULL,
    ADD COLUMN `serviceDate` DATETIME(3) NULL,
    ADD COLUMN `serviceTime` VARCHAR(191) NULL,
    ADD COLUMN `zone` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `painter` ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `city` VARCHAR(191) NOT NULL,
    ADD COLUMN `serviceType` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `PainterGallery` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `painterId` INTEGER NOT NULL,
    `imageUrl` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PainterReview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `painterId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `review` VARCHAR(191) NOT NULL,
    `rating` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PainterGallery` ADD CONSTRAINT `PainterGallery_painterId_fkey` FOREIGN KEY (`painterId`) REFERENCES `Painter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PainterReview` ADD CONSTRAINT `PainterReview_painterId_fkey` FOREIGN KEY (`painterId`) REFERENCES `Painter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PainterReview` ADD CONSTRAINT `PainterReview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
