-- AlterTable
ALTER TABLE `order` ADD COLUMN `paymentMethod` ENUM('visa', 'mastercard', 'apple_pay') NULL;
