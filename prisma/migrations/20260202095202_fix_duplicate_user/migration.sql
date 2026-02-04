/*
  Warnings:

  - You are about to drop the column `areaKnown` on the `selection` table. All the data in the column will be lost.
  - You are about to drop the column `totalArea` on the `selection` table. All the data in the column will be lost.
  - Made the column `area` on table `selection` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `selection` DROP COLUMN `areaKnown`,
    DROP COLUMN `totalArea`,
    MODIFY `area` DOUBLE NOT NULL,
    MODIFY `recommendedQuantity` INTEGER NOT NULL;
