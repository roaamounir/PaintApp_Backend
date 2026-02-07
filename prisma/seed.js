import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Start seeding...");

  // 1. ===== Onboarding Sliders =====
  console.log("Seeding Onboarding...");
  await prisma.onboarding.createMany({
    data: [
      {
        title: "اكتشف عالم الألوان",
        description: "تصفح آلاف الدهانات من أفضل الشركات",
        imageUrl: "onboarding1.png",
        order: 1,
      },
      {
        title: "فنيين محترفين",
        description: "اطلب فني طلاء خبير بضغطة زر",
        imageUrl: "onboarding2.png",
        order: 2,
      },
      {
        title: "محاكاة ذكية",
        description: "جرب اللون على حائطك قبل الشراء",
        imageUrl: "onboarding3.png",
        order: 3,
      },
    ],
  });

  // 2. ===== Users =====
  console.log("Seeding Users...");
  const vendorUser = await prisma.user.upsert({
    where: { email: "vendor@example.com" },
    update: {},
    create: {
      name: "شركة دهانات المستقبل",
      email: "vendor@example.com",
      phone: "01000000001",
      password: "hashed_password", 
      role: "vendor",
    },
  });

  const painterUser = await prisma.user.upsert({
    where: { email: "painter@example.com" },
    update: {},
    create: {
      name: "الأسطى محمد الصباغ",
      email: "painter@example.com",
      phone: "01000000002",
      password: "hashed_password",
      role: "painter",
    },
  });

  // 3. ===== Vendor Profile =====
  const vendor = await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: {},
    create: {
      userId: vendorUser.id,
      shopName: "المستقبل للدهانات",
      taxRegistration: "123-456-789",
      companyType: "شركة مساهمة",
      isApproved: true,
      city: "القاهرة",
      address: "مدينة نصر - الحي السابع",
    },
  });

  // 4. ===== Painter Profile =====
  const painter = await prisma.painter.upsert({
    where: { userId: painterUser.id },
    update: {},
    create: {
      userId: painterUser.id,
      rating: 4.8,
      experience: 10,
      city: "الجيزة",
      service: "both",
      address: "فيصل الرئيسي",
    },
  });

  // 5. ===== Categories & SubCategories =====
  const catInterior = await prisma.category.upsert({
    where: { name: "دهانات داخلية" },
    update: {},
    create: { name: "دهانات داخلية" },
  });

  const subCatPlastic = await prisma.subCategory.create({
    data: { name: "بلاستيك مط", categoryId: catInterior.id },
  });

  // 6. ===== Paints (Products) =====
  await prisma.paint.create({
    data: {
      name: "جوتن فينوماستيك",
      description: "دهان داخلي عالي الجودة قابل للغسل",
      price: 850.5,
      stock: 50,
      coverage: 12.5,
      coatHours: 4,
      dryDays: 1,
      base: "water",
      finish: "semi_gloss",
      unit: "liter",
      usage: "indoor",
      vendorId: vendor.id,
      categoryId: catInterior.id,
      subCategoryId: subCatPlastic.id,
    },
  });

  // 7. ===== Color System =====
  const jotunSystem = await prisma.colorSystem.upsert({
    where: { name: "Jotun Colors" },
    update: {},
    create: { name: "Jotun Colors" },
  });

  await prisma.color.createMany({
    data: [
      {
        code: "1001",
        hex: "#F0EAD6",
        rgb: "rgb(240, 234, 214)",
        colorSystemId: jotunSystem.id,
      },
      {
        code: "2010",
        hex: "#E5E4E2",
        rgb: "rgb(240, 234, 114)",
        colorSystemId: jotunSystem.id,
      },
    ],
  });

  console.log("Seeding completed successfully! 🌱");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
