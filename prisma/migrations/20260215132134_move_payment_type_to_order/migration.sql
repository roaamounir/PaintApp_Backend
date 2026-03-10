/*
  Warnings:

  - You are about to drop the column `paymentType` on the `paint` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `order` ADD COLUMN `paymentType` VARCHAR(191) NOT NULL DEFAULT 'cash';

-- AlterTable
ALTER TABLE `paint` DROP COLUMN `paymentType`;
