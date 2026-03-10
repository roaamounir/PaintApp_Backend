-- AlterTable
ALTER TABLE `painter` ADD COLUMN `adminNotes` TEXT NULL,
    ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `lastActive` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `verificationStatus` VARCHAR(191) NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `painterreview` ADD COLUMN `images` JSON NULL,
    ADD COLUMN `isReported` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `PainterDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `painterId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PainterDocument` ADD CONSTRAINT `PainterDocument_painterId_fkey` FOREIGN KEY (`painterId`) REFERENCES `Painter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
