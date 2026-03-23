-- AlterTable: add 'designer' to user_role enum
ALTER TABLE `user` MODIFY COLUMN `role` ENUM('user', 'admin', 'painter', 'vendor', 'designer') NOT NULL DEFAULT 'user';

-- CreateTable: design
CREATE TABLE `design` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `designerId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `videoUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `Design_designerId_fkey`(`designerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: design_comment
CREATE TABLE `design_comment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `designId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `text` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DesignComment_designId_fkey`(`designId`),
    INDEX `DesignComment_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: design_favorite
CREATE TABLE `design_favorite` (
    `userId` INTEGER NOT NULL,
    `designId` INTEGER NOT NULL,

    INDEX `DesignFavorite_designId_fkey`(`designId`),
    PRIMARY KEY (`userId`, `designId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: design_request
CREATE TABLE `design_request` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `designId` INTEGER NOT NULL,
    `clientUserId` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `videoUrl` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DesignRequest_designId_fkey`(`designId`),
    INDEX `DesignRequest_clientUserId_fkey`(`clientUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
