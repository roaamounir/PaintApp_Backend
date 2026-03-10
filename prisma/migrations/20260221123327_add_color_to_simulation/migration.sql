-- AlterTable
ALTER TABLE `colorsimulation` ADD COLUMN `colorId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `ColorSimulation_colorId_idx` ON `ColorSimulation`(`colorId`);

-- AddForeignKey
ALTER TABLE `ColorSimulation` ADD CONSTRAINT `ColorSimulation_colorId_fkey` FOREIGN KEY (`colorId`) REFERENCES `Color`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
