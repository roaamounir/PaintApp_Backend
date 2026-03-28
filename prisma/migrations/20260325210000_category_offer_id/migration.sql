-- ربط اختياري بين القسم والعرض (مفتاح أجنبي يُنشئ فهرساً على offerId)
ALTER TABLE `category` ADD COLUMN `offerId` VARCHAR(191) NULL;
ALTER TABLE `category` ADD CONSTRAINT `Category_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `offer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
