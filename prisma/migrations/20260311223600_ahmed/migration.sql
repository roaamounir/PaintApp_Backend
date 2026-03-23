-- DropForeignKey
ALTER TABLE `cart` DROP FOREIGN KEY `Cart_paintId_fkey`;

-- DropForeignKey
ALTER TABLE `cart` DROP FOREIGN KEY `Cart_userId_fkey`;

-- DropForeignKey
ALTER TABLE `chatmessage` DROP FOREIGN KEY `ChatMessage_userId_fkey`;

-- DropForeignKey
ALTER TABLE `designerprofile` DROP FOREIGN KEY `DesignerProfile_userId_fkey`;

-- DropForeignKey
ALTER TABLE `favoritecolor` DROP FOREIGN KEY `FavoriteColor_userId_fkey`;

-- DropForeignKey
ALTER TABLE `favoriteproduct` DROP FOREIGN KEY `FavoriteProduct_paintId_fkey`;

-- DropForeignKey
ALTER TABLE `favoriteproduct` DROP FOREIGN KEY `FavoriteProduct_userId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_painterId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_userId_fkey`;

-- DropForeignKey
ALTER TABLE `orderitem` DROP FOREIGN KEY `OrderItem_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `orderitem` DROP FOREIGN KEY `OrderItem_paintId_fkey`;

-- DropForeignKey
ALTER TABLE `paint` DROP FOREIGN KEY `Paint_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `paint` DROP FOREIGN KEY `Paint_offerId_fkey`;

-- DropForeignKey
ALTER TABLE `paint` DROP FOREIGN KEY `Paint_subCategoryId_fkey`;

-- DropForeignKey
ALTER TABLE `paint` DROP FOREIGN KEY `Paint_vendorId_fkey`;

-- DropForeignKey
ALTER TABLE `paintattribute` DROP FOREIGN KEY `PaintAttribute_attributeId_fkey`;

-- DropForeignKey
ALTER TABLE `paintattribute` DROP FOREIGN KEY `PaintAttribute_paintId_fkey`;

-- DropForeignKey
ALTER TABLE `painter` DROP FOREIGN KEY `Painter_userId_fkey`;

-- DropForeignKey
ALTER TABLE `paintergallery` DROP FOREIGN KEY `PainterGallery_painterId_fkey`;

-- DropForeignKey
ALTER TABLE `painterreview` DROP FOREIGN KEY `PainterReview_painterId_fkey`;

-- DropForeignKey
ALTER TABLE `painterreview` DROP FOREIGN KEY `PainterReview_userId_fkey`;

-- DropForeignKey
ALTER TABLE `selection` DROP FOREIGN KEY `Selection_paintId_fkey`;

-- DropForeignKey
ALTER TABLE `selection` DROP FOREIGN KEY `Selection_userId_fkey`;

-- DropForeignKey
ALTER TABLE `subcategory` DROP FOREIGN KEY `SubCategory_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `usercategory` DROP FOREIGN KEY `UserCategory_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `usercategory` DROP FOREIGN KEY `UserCategory_userId_fkey`;

-- DropForeignKey
ALTER TABLE `vendor` DROP FOREIGN KEY `Vendor_userId_fkey`;
