-- AlterTable
ALTER TABLE `order` ADD COLUMN `isPaid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `paymentType` VARCHAR(191) NULL DEFAULT 'cash';
