-- Paint products are admin catalog items; vendor link is optional.
ALTER TABLE `paint` MODIFY `vendorId` VARCHAR(191) NULL;
