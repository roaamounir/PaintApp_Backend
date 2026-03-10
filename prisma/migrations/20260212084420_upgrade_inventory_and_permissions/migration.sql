/*
  Warnings:

  - A unique constraint covering the columns `[orderNumber]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `orderNumber` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `color` ADD COLUMN `brand` VARCHAR(191) NULL,
    ADD COLUMN `lab_a` DOUBLE NULL,
    ADD COLUMN `lab_b` DOUBLE NULL,
    ADD COLUMN `lab_l` DOUBLE NULL;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `isPaid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `orderNumber` VARCHAR(191) NOT NULL,
    ADD COLUMN `paymentType` VARCHAR(191) NOT NULL DEFAULT 'cash',
    ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'app';

-- AlterTable
ALTER TABLE `paint` ADD COLUMN `minStockLevel` INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'available';

-- AlterTable
ALTER TABLE `user` ADD COLUMN `balance` DOUBLE NOT NULL DEFAULT 0.0,
    ADD COLUMN `creditLimit` DOUBLE NOT NULL DEFAULT 0.0,
    ADD COLUMN `permissions` JSON NULL;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `details` TEXT NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Order_orderNumber_key` ON `Order`(`orderNumber`);

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
