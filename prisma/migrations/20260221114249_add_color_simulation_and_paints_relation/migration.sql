-- AlterTable
ALTER TABLE `paint` ADD COLUMN `colorId` INTEGER NULL;

-- CreateTable
CREATE TABLE `ColorSimulation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `originalImage` VARCHAR(191) NOT NULL,
    `resultImage` VARCHAR(191) NULL,
    `appliedSelections` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ColorSimulation_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Paint` ADD CONSTRAINT `Paint_colorId_fkey` FOREIGN KEY (`colorId`) REFERENCES `Color`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ColorSimulation` ADD CONSTRAINT `ColorSimulation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
