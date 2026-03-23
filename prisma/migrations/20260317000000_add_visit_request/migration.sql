-- CreateTable: طلب زيارة من العميل للفني (التاريخ، الوقت، المساحة، العنوان)
CREATE TABLE IF NOT EXISTS `visit_request` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `clientUserId` INTEGER NOT NULL,
  `painterId` INTEGER NOT NULL,
  `scheduledDate` DATETIME(3) NOT NULL,
  `scheduledTime` VARCHAR(191) NOT NULL,
  `area` DOUBLE NULL,
  `address` TEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `notes` TEXT NULL,

  INDEX `VisitRequest_clientUserId_fkey`(`clientUserId`),
  INDEX `VisitRequest_painterId_fkey`(`painterId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
