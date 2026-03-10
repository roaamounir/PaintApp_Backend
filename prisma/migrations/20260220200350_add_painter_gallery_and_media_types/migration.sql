/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `paintergallery` table. All the data in the column will be lost.
  - Added the required column `url` to the `PainterGallery` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `paintergallery` DROP COLUMN `imageUrl`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `displayOrder` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `mediaType` ENUM('image', 'video') NOT NULL DEFAULT 'image',
    ADD COLUMN `thumbnail` VARCHAR(191) NULL,
    ADD COLUMN `title_ar` VARCHAR(191) NULL,
    ADD COLUMN `title_en` VARCHAR(191) NULL,
    ADD COLUMN `url` VARCHAR(191) NOT NULL;

-- RenameIndex
ALTER TABLE `paintergallery` RENAME INDEX `PainterGallery_painterId_fkey` TO `PainterGallery_painterId_idx`;
