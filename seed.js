// seed.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // ===== Users =====
  const user = await prisma.user.upsert({
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

  // =====  Vendor =====
  const vendor = await prisma.vendor.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      shopName: "Shop A",
      city: "Cairo",
      address: "123 Street",
    },
  });

  // =====  Categories =====
  const category1 = await prisma.category.upsert({
    where: { name: "Interior" },
    update: {},
    create: { name: "Interior", description: "Interior Paints" },
  });

  const category2 = await prisma.category.upsert({
    where: { name: "Exterior" },
    update: {},
    create: { name: "Exterior", description: "Exterior Paints" },
  });

  const category3 = await prisma.category.upsert({
    where: { name: "Premium" },
    update: {},
    create: { name: "Premium", description: "Premium Paints" },
  });


  const subCategory1 = await prisma.subCategory.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Premium Indoor", categoryId: category3.id },
  });

  // =====  Paints =====
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
    },
  });

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
