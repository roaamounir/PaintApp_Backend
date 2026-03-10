/*
  Warnings:

  - You are about to drop the column `commissionRate` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `user` DROP COLUMN `commissionRate`;

-- AlterTable
ALTER TABLE `vendor` ADD COLUMN `commissionRate` DOUBLE NOT NULL DEFAULT 10.0;
