/**
 * سكربت إضافة مصممين وتصاميم فقط (يعمل بـ raw SQL ولا يعتمد على Prisma client كامل)
 * التشغيل: node seed-designers.js
 * تأكد من تنفيذ migration إضافة designer والجداول design أولاً.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const userPass = await bcrypt.hash("User@123", 10);

  // 1) إضافة/تحديث مصممين في user
  await prisma.$executeRawUnsafe(
    "INSERT INTO `user` (name, email, phone, password, role, createdAt) VALUES (?, ?, ?, ?, 'designer', NOW()) ON DUPLICATE KEY UPDATE role = 'designer', name = VALUES(name)",
    "سلمى المصممة",
    "designer@paintapp.com",
    "01000000030",
    userPass
  );
  await prisma.$executeRawUnsafe(
    "INSERT INTO `user` (name, email, phone, password, role, createdAt) VALUES (?, ?, ?, ?, 'designer', NOW()) ON DUPLICATE KEY UPDATE role = 'designer', name = VALUES(name)",
    "كريم مصمم ديكور",
    "designer2@paintapp.com",
    "01000000031",
    userPass
  );

  const rows = await prisma.$queryRawUnsafe(
    "SELECT id, email FROM `user` WHERE email IN (?, ?)",
    "designer@paintapp.com",
    "designer2@paintapp.com"
  );
  const designer1 = rows[0];
  const designer2 = rows[1];
  if (!designer1 || !designer2) {
    throw new Error("لم يتم العثور على المصممين بعد الإدراج");
  }

  // 2) بروفايل المصممين (designerprofile)
  await prisma.$executeRawUnsafe(
    `INSERT INTO designerprofile (userId, experience, specialties, rating, portfolio) VALUES (?, 5, 'ديكور داخلي، ألوان الجدران', 4.8, 'https://example.com/salma-portfolio')
     ON DUPLICATE KEY UPDATE experience = 5, specialties = VALUES(specialties), rating = 4.8, portfolio = VALUES(portfolio)`,
    designer1.id
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO designerprofile (userId, experience, specialties, rating, portfolio) VALUES (?, 3, 'تصميم واجهات، طلاء خارجي', 4.5, 'https://example.com/karim-portfolio')
     ON DUPLICATE KEY UPDATE experience = 3, specialties = VALUES(specialties), rating = 4.5, portfolio = VALUES(portfolio)`,
    designer2.id
  );

  // 3) التصاميم (design)
  const designData = [
    [designer1.id, "صالون بألوان محايدة", "تصميم صالون عصري بألوان بيج ورمادي مع لمسات ذهبية. مناسب للمساحات المتوسطة والكبيرة.", "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800", null],
    [designer1.id, "غرفة نوم هادئة", "غرفة نوم بألوان أزرق وبني فاتح مع إضاءة دافئة. جو مريح للنوم.", "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800", null],
    [designer1.id, "مطبخ أبيض لامع", "مطبخ حديث باللون الأبيض مع خزائن لامعة وبلاط رمادي. سهل التنظيف وعصري.", "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", null],
    [designer1.id, "غرفة معيشة دافئة", "ألوان ترابية وطبيعية مع خشب ونسيج. مناسب للبيوت العصرية.", "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", null],
    [designer1.id, "حمام أنيق", "حمام بألوان بيضاء ورمادية مع بلاط حديث وإضاءة مناسبة.", "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800", null],
    [designer1.id, "مكتب منزلي هادئ", "مساحة عمل بألوان محايدة وتهوية طبيعية لزيادة الإنتاجية.", "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800", null],
    [designer2.id, "واجهة منزل كلاسيكية", "طلاء واجهة خارجية بألوان كريمي وأبيض. يناسب الطراز الكلاسيكي والفلل.", "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800", null],
    [designer2.id, "غرفة أطفال ملونة", "غرفة أطفال بألوان زاهية وآمنة. جدران قابلة للغسل ومناسبة للألعاب.", "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", null],
    [designer2.id, "صالة استقبال فاخرة", "صالة استقبال بلون ذهبي وبني. إحساس بالفخامة والترحيب.", "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800", null],
    [designer2.id, "شرفة خارجية مريحة", "طلاء ودهان للشرفات مقاوم للطقس بألوان هادئة.", "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800", null],
    [designer2.id, "مدخل عصري", "مدخل المنزل بألوان فاتحة ولوحة جدارية بسيطة.", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800", null],
    [designer2.id, "غرفة ضيوف أنيقة", "ألوان محايدة مع لمسات دافئة لاستقبال الضيوف.", "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800", null],
  ];

  for (const [designerId, title, description, imageUrl, videoUrl] of designData) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO design (designerId, title, description, imageUrl, videoUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      designerId,
      title,
      description,
      imageUrl,
      videoUrl
    );
  }

  console.log("تمت إضافة مصممين وتصاميم بنجاح.");
  console.log("  مصمم 1:", designer1.email, "(id:", designer1.id, ")");
  console.log("  مصمم 2:", designer2.email, "(id:", designer2.id, ")");
  console.log("  عدد التصاميم المضافة:", designData.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
