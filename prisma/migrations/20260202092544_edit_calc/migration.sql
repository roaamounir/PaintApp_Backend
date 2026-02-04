/*
  Warnings:

  - You are about to drop the column `wallArea` on the `selection` table. All the data in the column will be lost.
  - Added the required column `recommendedQuantity` to the `Selection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalArea` to the `Selection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `selection` DROP COLUMN `wallArea`,
    ADD COLUMN `area` DOUBLE NULL,
    ADD COLUMN `areaKnown` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `height` DOUBLE NULL,
    ADD COLUMN `length` DOUBLE NULL,
    ADD COLUMN `recommendedQuantity` DOUBLE NOT NULL,
    ADD COLUMN `totalArea` DOUBLE NOT NULL,
    ADD COLUMN `width` DOUBLE NULL;
