/*
  Warnings:

  - Added the required column `discountType` to the `Offer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `offer` ADD COLUMN `discountType` ENUM('percentage', 'fixed') NOT NULL;

-- AlterTable
ALTER TABLE `paint` ADD COLUMN `inStock` BOOLEAN NOT NULL DEFAULT true;
