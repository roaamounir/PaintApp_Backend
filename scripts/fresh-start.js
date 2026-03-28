/**
 * مسح كل بيانات قاعدة البيانات ثم إنشاء مستخدم أدمن فقط.
 * التشغيل: CONFIRM_PURGE=yes npm run db:fresh
 *
 * قبل التشغيل (مرة واحدة بعد تحديث المخطط):
 *   npx prisma db push
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "../src/prismaClient.js";

const TRUNCATE_TABLES = [
  "design_request",
  "design_comment",
  "design_favorite",
  "design",
  "visit_request",
  "orderitem",
  "`order`",
  "cart",
  "favoriteproduct",
  "paintattribute",
  "selection",
  "paintergallery",
  "painterreview",
  "painter",
  "favoritecolor",
  "chatmessage",
  "auditlog",
  "otp",
  "designerprofile",
  "usercategory",
  "paint",
  "offer",
  "vendor",
  "user",
  "category",
  "attribute",
];

async function dropLegacyTables() {
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS `system_color`");
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS `color_system`");
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS `subcategory`");
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS `SubCategory`");
}

async function purgeAll() {
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
  for (const t of TRUNCATE_TABLES) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${t}`);
  }
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");
}

async function seedAdmin() {
  const adminPass = await bcrypt.hash("Admin@123", 10);
  await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@paintapp.com",
      phone: "01000000000",
      password: adminPass,
      role: "admin",
    },
  });
}

async function main() {
  if (process.env.CONFIRM_PURGE !== "yes") {
    console.error("للمسح الكامل ثم بذور أدمن فقط، شغّل:");
    console.error("  CONFIRM_PURGE=yes npm run db:fresh");
    process.exit(1);
  }
  console.log("حذف جداول قديمة إن وُجدت (subcategory, color_system)...");
  await dropLegacyTables();
  console.log("تفريغ كل الجداول...");
  await purgeAll();
  console.log("إنشاء الأدمن...");
  await seedAdmin();
  console.log("تم. الدخول: 01000000000 أو admin@paintapp.com — كلمة المرور: Admin@123");
  console.log("لإضافة مجموعة المستخدمين التجريبيين شغّل: npm run seed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
