import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Start seeding...");

  // 1. ===== Users =====
  const vendorUser = await prisma.user.upsert({
    where: { email: "vendor@example.com" },
    update: {},
    create: {
      name: "Vendor User",
      email: "vendor@example.com",
      phone: "01000000001",
      password: "hashed_password",
      role: "vendor",
    },
  });

  const painterUser = await prisma.user.upsert({
    where: { email: "painter1@example.com" },
    update: {},
    create: {
      name: "Painter One",
      email: "painter1@example.com",
      phone: "01000000002",
      password: "hashed_password",
      role: "painter",
    },
  });

  // 2. ===== Vendor =====
  const vendor = await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: {},
    create: {
      userId: vendorUser.id,
      shopName: "Shop A",
      city: "Cairo",
      address: "123 Street",
    },
  });

  // 3. ===== Categories & SubCategories =====
  const category3 = await prisma.category.upsert({
    where: { name: "Premium" },
    update: {},
    create: { name: "Premium", description: "Premium Paints" },
  });

  const subCategory1 = await prisma.subcategory.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Premium Indoor", categoryId: category3.id },
  });

  // 4. ===== Painters & Reviews =====
  const painter = await prisma.painter.upsert({
    where: { userId: painterUser.id },
    update: {},
    create: {
      userId: painterUser.id,
      rating: 4.5,
      experience: 5,
      city: "Cairo",
      serviceType: "indoor",
      address: "123 Main St",
    },
  });

  // 5. ===== Paints =====
  await prisma.paint.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Premium Paint",
      type: "acrylic",
      description: "High quality premium paint",
      price: 150,
      unit: "liter",
      coverage: 10,
      coatHours: 4,
      dryDays: 2,
      finish: "matte",
      usage: "indoor",
      base: "water",
      stock: 20,
      categoryId: category3.id,
      subCategoryId: subCategory1.id,
      vendorId: vendor.id,
      updatedAt: new Date(),
    },
  });

  const pantone = await prisma.colorSystem.upsert({
    where: { name: "PANTONE" },
    update: {},
    create: { name: "PANTONE" },
  });

  const ral = await prisma.colorSystem.upsert({
    where: { name: "RAL" },
    update: {},
    create: { name: "RAL" },
  });

  await prisma.color.upsert({
    where: { id: 1 },
    update: {},
    create: {
      code: "186 C",
      colorSystemId: pantone.id,
      rgb: "200,16,46",
      hex: "#C8102E",
    },
  });

  await prisma.color.upsert({
    where: { id: 2 },
    update: {},
    create: {
      code: "3020",
      colorSystemId: ral.id,
      rgb: "171,0,0",
      hex: "#AB0000",
    },
  });

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
